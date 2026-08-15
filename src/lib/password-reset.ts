/**
 * Account Recovery & Verification V2 — Password Reset Grant service.
 *
 * Server-only. Never import from a Client Component (`'use client'`).
 *
 * A "reset grant" is a short-lived, single-use, high-entropy token issued
 * AFTER a valid password-reset OTP consumption. The raw grant is delivered
 * to the reset-password UI (typically as a response field on the OTP-verify
 * endpoint), and the UI submits it back to the reset-password endpoint
 * along with the new password.
 *
 * WHY A GRANT INSTEAD OF JUST "OTP VERIFIED → RESET PASSWORD"?
 *   - The OTP-verify and reset-password endpoints are separate HTTP calls.
 *     If the reset endpoint accepted "user is OTP-verified" as in-memory
 *     state, that state would have to live somewhere (server session, DB
 *     flag, signed cookie). Each option has issues:
 *       - server session: doesn't survive serverless cold-starts.
 *       - DB flag (e.g. `User.canResetPassword`): racy, requires cleanup.
 *       - signed cookie: works but adds a third trust channel alongside
 *         the session cookie and OAuth state cookie.
 *   - A short-lived grant in the DB is the simplest + most auditable
 *     option. The grant row is the SINGLE source of truth for "this user
 *     is allowed to reset their password right now." Once consumed
 *     (`consumedAt != null`), it can never be reused.
 *
 * SECURITY CONTRACT:
 *   - The raw grant is 32 bytes of CSPRNG output, hex-encoded (64 chars).
 *     Same entropy class as the V1 link-based verification token.
 *   - The DB stores only `sha256(rawGrant)` as `grantHash` — a DB
 *     compromise does NOT reveal active grants.
 *   - SHA-256 is sufficient here (unlike the 6-digit OTP, which requires
 *     HMAC because the input space is only 10^6) because the input is
 *     32 bytes of CSPRNG entropy — already brute-force-infeasible.
 *   - `expiresAt` is 10 minutes after creation. Short window so a leaked
 *     grant (e.g. from browser history or a shared computer) has limited
 *     usability.
 *   - `consumedAt` is NULL until the grant is consumed by the
 *     reset-password route. Once set, the grant can never be used again.
 *   - Concurrency-safe consumption: the reset-password route uses an
 *     interactive `db.$transaction(async (tx) => { ... })` that:
 *       (1) atomically claims the grant via `updateMany WHERE grantHash
 *           = ? AND consumedAt IS NULL AND expiresAt > now` (only one of
 *           two concurrent requests with the same grant can win),
 *       (2) GATES on `claim.count === 1`,
 *       (3) ONLY if the claim won: sets the new bcrypt password,
 *           bumps `User.sessionVersion`, and (as a cleanup) invalidates
 *           all unconsumed OTPs for the user.
 *   - All three mutations commit in the SAME transaction. If any throws,
 *     the entire transaction rolls back — the grant is NOT consumed and
 *     the password is NOT changed. The user can retry.
 *
 * ANTI-ENUMERATION NOTE:
 *   The grant is issued ONLY after a valid OTP consumption. The OTP-verify
 *   endpoint for password-reset returns the same shape whether the user
 *   exists or not (anti-enumeration). The grant field is `null` when the
 *   user doesn't exist; the client-side reset-password form is expected
 *   to handle a null grant by showing a generic error.
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'

/** Reset grant TTL — 10 minutes from issuance (V2 spec). */
export const RESET_GRANT_TTL_MS = 10 * 60 * 1000

/**
 * Generate a fresh 32-byte CSPRNG grant, hex-encoded (64 chars).
 * Same entropy class as the V1 link-based verification token.
 */
export function generateResetGrant(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Hash a raw grant with SHA-256 and return the hex digest. This is what
 * gets stored in `PasswordResetGrant.grantHash`.
 *
 * SHA-256 is sufficient here (unlike the 6-digit OTP) because the input
 * is 32 bytes of CSPRNG output — high-entropy, not a low-entropy password.
 * A slow KDF like bcrypt is not needed and would only slow down
 * verification without adding meaningful security.
 */
export function hashResetGrant(rawGrant: string): string {
  return createHash('sha256').update(rawGrant).digest('hex')
}

/**
 * Constant-time comparison of two hex digests. Returns true iff they are
 * the same length AND every byte matches.
 */
export function constantTimeEqualGrantHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    let diff = 0
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    return diff === 0
  }
}

// ---------------------------------------------------------------------------
// Issuance
// ---------------------------------------------------------------------------

export interface IssueResetGrantResult {
  /** The raw 64-char hex grant. The caller MUST deliver it to the
   *  reset-password UI (typically as a field on the OTP-verify response)
   *  and MUST NEVER log it. */
  grant: string
  /** When this grant expires (10 minutes from now). */
  expiresAt: Date
}

/**
 * Issue a new password-reset grant for a user. INVALIDATES all previously
 * unconsumed grants for the same user by setting `consumedAt = now()` —
 * only the newest grant is valid at any time.
 *
 * This function is called ONLY after a valid password-reset OTP
 * consumption (i.e. the user has proven control of their email via the
 * 6-digit code). It is NOT called by the forgot-password endpoint
 * directly — that endpoint only issues an OTP.
 *
 * Returns the RAW grant. The caller is responsible for delivering it to
 * the reset-password UI (typically as a field on the OTP-verify
 * response) and for NEVER logging it.
 *
 * The DB row that gets created stores ONLY `hashResetGrant(rawGrant)`.
 */
export async function issueResetGrant(userId: string): Promise<IssueResetGrantResult> {
  const grant = generateResetGrant()
  const grantHash = hashResetGrant(grant)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + RESET_GRANT_TTL_MS)

  // Atomically: invalidate old unconsumed grants for this user AND insert
  // the new one. Same transaction pattern as OTP issuance.
  await db.$transaction([
    db.passwordResetGrant.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: now },
    }),
    db.passwordResetGrant.create({
      data: { userId, grantHash, expiresAt, consumedAt: null },
    }),
  ])

  return { grant, expiresAt }
}

// ---------------------------------------------------------------------------
// Verification (claim — does NOT consume; the reset-password route consumes)
// ---------------------------------------------------------------------------

// Note: the actual CONSUMPTION of a reset grant happens inside the
// reset-password route's interactive transaction, because the grant
// claim, password update, and sessionVersion bump must all commit (or
// roll back) atomically. We do NOT expose a `consumeResetGrant` helper
// here because that would tempt future code to call it outside the
// transaction boundary.
//
// Instead, the reset-password route imports `hashResetGrant` and
// `constantTimeEqualGrantHash` from this module and does the atomic
// claim itself. This keeps the grant-consumption + password-update +
// sessionVersion-bump in a single transaction.
//
// See src/app/api/auth/reset-password/route.ts (stage 7) for the canonical
// implementation.
