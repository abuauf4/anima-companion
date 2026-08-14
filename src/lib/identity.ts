/**
 * Verified Identity V1 — token generation, hashing, and verification helpers.
 *
 * SECURITY CONTRACT:
 *   - Tokens are 32 bytes of CSPRNG output (Node `crypto.randomBytes`), hex-encoded.
 *   - The DB stores ONLY `sha256(token)` as `tokenHash`. A DB compromise does
 *     NOT reveal active tokens. An attacker with read access to the DB cannot
 *     redeem tokens; they can only see hashes.
 *   - Tokens expire 24h after creation.
 *   - Tokens are single-use: once `consumedAt` is set, the token can never be
 *     redeemed again. Consumption is atomic via `updateMany WHERE consumedAt IS NULL`.
 *   - When a new verification email is requested, all UNCONSUMED tokens for
 *     the user are invalidated by setting `consumedAt = now()`. Only the
 *     newest token is valid at any time.
 *   - Concurrent verification is safe: if two requests arrive with the same
 *     token, only one `updateMany` returns `count=1`; the loser returns the
 *     same success response (idempotent — `emailVerifiedAt` is set either way).
 *
 * These helpers are server-only. They must NEVER be imported into a Client
 * Component (`'use client'`). The raw token must NEVER appear in client
 * code or in a request body the client can read.
 */

import { randomBytes, createHash } from 'crypto'
import { db } from '@/lib/db'

// 24 hours — long enough that a user can check their email the next morning,
// short enough that a leaked token has a limited window of usability.
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Generate a new verification token (32 random bytes, hex-encoded → 64 chars).
 * The raw token is returned to the caller so it can be embedded in a
 * verification link / email body. The caller MUST NOT log or persist the raw
 * token — only the SHA-256 hash should reach the DB.
 */
export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Hash a raw token with SHA-256 and return the hex digest. This is what
 * gets stored in `EmailVerificationToken.tokenHash`.
 *
 * SHA-256 is sufficient here because the input is a 32-byte CSPRNG output
 * (high-entropy, not a low-entropy password). A slow KDF like bcrypt is not
 * needed and would only slow down verification without adding meaningful
 * security — the threat model is "DB leak", and 32 bytes of entropy is
 * already brute-force-infeasible.
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

/**
 * Issue a new verification token for a user. INVALIDATES all previously
 * unconsumed tokens for that user by setting `consumedAt = now()` on them —
 * only the newest token is valid at any time. This prevents token pile-up
 * and limits the window of any one stolen email-link.
 *
 * Returns the RAW token. The caller is responsible for:
 *   - delivering it to the user's email address via a trusted channel
 *     (the email adapter), AND
 *   - NEVER logging it, returning it in an API response body, or
 *     persisting it in plaintext anywhere.
 *
 * The DB row that gets created stores ONLY `hashToken(rawToken)`.
 */
export async function issueVerificationToken(userId: string): Promise<string> {
  const rawToken = generateVerificationToken()
  const tokenHash = hashToken(rawToken)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS)

  // Atomically: invalidate old unconsumed tokens AND insert the new one.
  // We use a transaction so that a crash between the two operations can't
  // leave the user with TWO active tokens (which would be a minor security
  // regression, not a vulnerability — but cleaner to avoid).
  await db.$transaction([
    // Mark all existing unconsumed tokens for this user as consumed. We
    // don't delete them — the consumedAt timestamp is an audit trail.
    db.emailVerificationToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: now },
    }),
    // Insert the new token.
    db.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    }),
  ])

  return rawToken
}

/**
 * Verify a token against the DB. Returns one of:
 *   - 'OK'                       — token was valid and is now consumed; caller
 *                                  should set `User.emailVerifiedAt = now()`.
 *   - 'ALREADY_VERIFIED'         — token was valid AND user is already
 *                                  verified. Token is still consumed.
 *   - 'ALREADY_CONSUMED'         — token hash matches a row but
 *                                  `consumedAt` is already set (concurrent
 *                                  request won the race, OR the user clicked
 *                                  the link twice). Idempotent — caller
 *                                  should treat as success if user is already
 *                                  verified.
 *   - 'EXPIRED'                  — token hash matches but `expiresAt < now`.
 *   - 'NOT_FOUND'                — no row matches this token hash. Either
 *                                  the token is malformed, was never issued,
 *                                  or was issued for a user who has since
 *                                  been deleted (cascade).
 *
 * The function ATOMICALLY claims the token via `updateMany WHERE consumedAt
 * IS NULL AND expiresAt > now()`. This means concurrent requests with the
 * same valid token will race: exactly one will get `count=1` (OK), the
 * other will get `count=0` (which we surface as `ALREADY_CONSUMED` — the
 * idempotent outcome).
 *
 * On `OK` or `ALREADY_VERIFIED`, the caller is responsible for setting
 * `User.emailVerifiedAt = now()` IF it is not already set. Use
 * `markEmailVerified()` for that — it's idempotent too.
 */
export type VerifyTokenResult =
  | 'OK'
  | 'ALREADY_VERIFIED'
  | 'ALREADY_CONSUMED'
  | 'EXPIRED'
  | 'NOT_FOUND'

export interface ConsumeTokenResponse {
  result: VerifyTokenResult
  userId?: string
}

export async function consumeVerificationToken(rawToken: string): Promise<ConsumeTokenResponse> {
  const tokenHash = hashToken(rawToken)
  const now = new Date()

  // Look up the row first to give a precise error code (NOT_FOUND vs EXPIRED
  // vs ALREADY_CONSUMED). The actual claim is the updateMany below; this
  // read is for diagnostics only.
  const row = await db.emailVerificationToken.findUnique({
    where: { tokenHash },
    select: { userId: true, consumedAt: true, expiresAt: true },
  })
  if (!row) return { result: 'NOT_FOUND' }
  if (row.consumedAt) return { result: 'ALREADY_CONSUMED', userId: row.userId }
  if (row.expiresAt < now) return { result: 'EXPIRED', userId: row.userId }

  // Atomic claim: only this request can win. Two concurrent requests with
  // the same token will see count=1 and count=0 respectively.
  const claim = await db.emailVerificationToken.updateMany({
    where: { tokenHash, consumedAt: null, expiresAt: { gt: now } },
    data: { consumedAt: now },
  })
  if (claim.count === 0) {
    // Race lost — another request just consumed it. Idempotent outcome.
    return { result: 'ALREADY_CONSUMED', userId: row.userId }
  }

  // Check if the user is already verified (e.g. they verified via a
  // different provider, or they re-verified after the first successful
  // link). If so, we still consumed the token (audit trail) but we don't
  // need to write `emailVerifiedAt` again.
  const user = await db.user.findUnique({
    where: { id: row.userId },
    select: { emailVerifiedAt: true },
  })
  if (user?.emailVerifiedAt) {
    return { result: 'ALREADY_VERIFIED', userId: row.userId }
  }

  return { result: 'OK', userId: row.userId }
}

/**
 * Mark a user's email as verified. Idempotent — if `emailVerifiedAt` is
 * already set, this is a no-op. Returns the resulting `emailVerifiedAt`
 * value (so the caller can return it in an API response if needed).
 *
 * This is the ONLY function in the codebase that sets `emailVerifiedAt`
 * for a PASSWORD user. The Google OAuth callback sets it directly at user
 * creation time (because Google's `email_verified` claim is the trusted
 * authority).
 */
export async function markEmailVerified(userId: string): Promise<Date> {
  const now = new Date()
  // Idempotent: only set if NULL. If already set, keep the original.
  await db.user.updateMany({
    where: { id: userId, emailVerifiedAt: null },
    data: { emailVerifiedAt: now },
  })
  // Read back to return the authoritative value (in case it was already
  // set by a concurrent request and `now` is not what got persisted).
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  })
  return user?.emailVerifiedAt ?? now
}
