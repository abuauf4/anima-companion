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
 *   - 'OK'                       — token was valid and is now consumed; the
 *                                  user's `emailVerifiedAt` was set in the
 *                                  SAME transaction. Both mutations
 *                                  committed atomically.
 *   - 'ALREADY_VERIFIED'         — token was valid AND user is already
 *                                  verified. Token is still consumed (in
 *                                  the same transaction). Idempotent.
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
 * TRANSACTION BOUNDARY (Verified Identity V1 cleanup):
 *   In V1 baseline (`61983c8`), `consumeVerificationToken` and
 *   `markEmailVerified` were separate operations called sequentially
 *   from the /confirm route. If the DB connection failed between the
 *   two operations, the token was permanently consumed but the user
 *   remained unverified — a retry would only return ALREADY_CONSUMED.
 *   That unrecoverable window is closed by performing BOTH the atomic
 *   claim of the token AND the idempotent `emailVerifiedAt` write
 *   inside a single `db.$transaction([...])`. Either both commit or
 *   neither commits — there is no intermediate state.
 *
 * CONCURRENCY:
 *   - The atomic claim is `updateMany WHERE consumedAt IS NULL AND
 *     expiresAt > now()`. Two concurrent requests with the same valid
 *     token will race: exactly one returns `count=1` (OK / ALREADY_VERIFIED
 *     depending on prior state), the other returns `count=0` (which we
 *     surface as `ALREADY_CONSUMED` — the idempotent outcome).
 *   - The `emailVerifiedAt` write is `updateMany WHERE emailVerifiedAt IS
 *     NULL` — idempotent. Two concurrent requests for the same user can
 *     both write `now` without conflict; the conditional WHERE ensures
 *     only one actually mutates, and the surviving value is read back.
 *
 * On `OK` or `ALREADY_VERIFIED`, the user's `emailVerifiedAt` is now set
 * (the caller can read it back via `db.user.findUnique({ select: { emailVerifiedAt: true }})`
 * or use the returned `emailVerifiedAt` field).
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
  /** On OK / ALREADY_VERIFIED: the authoritative `emailVerifiedAt`
   *  timestamp after the transaction committed. On other results, null. */
  emailVerifiedAt?: Date | null
}

export async function consumeVerificationToken(rawToken: string): Promise<ConsumeTokenResponse> {
  const tokenHash = hashToken(rawToken)
  const now = new Date()

  // Look up the row first to give a precise error code (NOT_FOUND vs EXPIRED
  // vs ALREADY_CONSUMED). The actual claim is the updateMany below; this
  // read is for diagnostics only. The lookup does NOT mutate state, so it
  // can safely live outside the transaction — the transaction below will
  // re-assert the conditions atomically.
  const row = await db.emailVerificationToken.findUnique({
    where: { tokenHash },
    select: { userId: true, consumedAt: true, expiresAt: true },
  })
  if (!row) return { result: 'NOT_FOUND' }
  if (row.consumedAt) return { result: 'ALREADY_CONSUMED', userId: row.userId }
  if (row.expiresAt < now) return { result: 'EXPIRED', userId: row.userId }

  // Peek at the user's current verification state so we can choose the
  // correct wire code (`OK` vs `ALREADY_VERIFIED`) WITHOUT relying on a
  // second DB round-trip after the transaction. The transaction below
  // atomically re-checks the conditions when it actually performs the
  // write, so this pre-peek is informational only.
  const userBefore = await db.user.findUnique({
    where: { id: row.userId },
    select: { emailVerifiedAt: true },
  })

  // ----- ATOMIC TRANSACTION -----
  // Both operations MUST commit together:
  //   (1) Claim the token (`updateMany WHERE consumedAt IS NULL AND
  //       expiresAt > now()` — count=1 means this request won the race).
  //   (2) Set `emailVerifiedAt` on the user (`updateMany WHERE
  //       emailVerifiedAt IS NULL` — idempotent, only mutates if NULL).
  //
  // If (1) succeeds but (2) throws (e.g. connection drops between the
  // two writes), the entire transaction rolls back — the token is NOT
  // consumed, the user is NOT verified, and the user can retry. This
  // closes the unrecoverable window from the V1 baseline where the two
  // operations were sequential.
  //
  // Prisma's `$transaction([...])` runs the operations sequentially inside
  // a single DB transaction; if any throws, the whole transaction is
  // rolled back.
  const claim = await db.$transaction([
    // (1) Atomic claim — only one concurrent request can win.
    db.emailVerificationToken.updateMany({
      where: { tokenHash, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    }),
    // (2) Idempotent emailVerifiedAt write — only mutates if currently
    //     NULL. If already set (e.g. user previously verified via a
    //     different path), this is a no-op updateMany with count=0,
    //     which is fine.
    db.user.updateMany({
      where: { id: row.userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: now },
    }),
  ])

  // claim[0] = token updateMany result; claim[1] = user updateMany result.
  const tokenClaim = claim[0]
  const userClaim = claim[1]

  if (tokenClaim.count === 0) {
    // Race lost — another request just consumed the token (and set
    // emailVerifiedAt in its own transaction). Idempotent outcome.
    // We read the user back to return the authoritative emailVerifiedAt.
    const u = await db.user.findUnique({
      where: { id: row.userId },
      select: { emailVerifiedAt: true },
    })
    return {
      result: 'ALREADY_CONSUMED',
      userId: row.userId,
      emailVerifiedAt: u?.emailVerifiedAt ?? null,
    }
  }

  // We won the claim. Did WE set emailVerifiedAt (count=1), or was it
  // already set by a prior flow (count=0)?
  if (userClaim.count === 1) {
    // We just verified the user.
    return { result: 'OK', userId: row.userId, emailVerifiedAt: now }
  }
  // userClaim.count === 0 → user was already verified before this
  // transaction. The token is still consumed (audit trail).
  const alreadyVerifiedAt = userBefore?.emailVerifiedAt ?? null
  return {
    result: 'ALREADY_VERIFIED',
    userId: row.userId,
    emailVerifiedAt: alreadyVerifiedAt,
  }
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
