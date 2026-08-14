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
 *                                  the link twice, OR a fresh
 *                                  `issueVerificationToken` invalidated the
 *                                  token between the lookup and the claim).
 *                                  Idempotent — caller should treat as
 *                                  success if user is already verified.
 *   - 'EXPIRED'                  — token hash matches but `expiresAt <= now`.
 *   - 'NOT_FOUND'                — no row matches this token hash. Either
 *                                  the token is malformed, was never issued,
 *                                  or was issued for a user who has since
 *                                  been deleted (cascade).
 *
 * TRANSACTION BOUNDARY (Verified Identity V1 cleanup v2 — interactive tx):
 *   v1 (commit 75634b2) used the array form `db.$transaction([...])` with
 *   two `updateMany` calls — one to claim the token, one to set
 *   `emailVerifiedAt`. The array form does NOT short-circuit when an
 *   `updateMany` returns `{ count: 0 }`: `count: 0` is a successful
 *   operation that simply matched no rows. The next operation in the
 *   array STILL executes. That means if the token claim lost the race
 *   (concurrent consume, or `issueVerificationToken` invalidated the
 *   token between the lookup and the claim, or the token just expired
 *   between the lookup and the claim), the `User.emailVerifiedAt` write
 *   would STILL fire — verifying the user through a token that was not
 *   actually claimable. That violates the core identity invariant:
 *
 *     valid + unconsumed + unexpired token
 *               ↓
 *     atomic claim succeeds (count === 1)
 *               ↓
 *     emailVerifiedAt may be written
 *
 *   v2 (this commit) switches to the INTERACTIVE form
 *   `db.$transaction(async (tx) => { ... })` so we can branch on
 *   `claim.count` BEFORE issuing the user write. If `claim.count !== 1`,
 *   the function returns `ALREADY_CONSUMED` WITHOUT writing
 *   `emailVerifiedAt`. Only when `claim.count === 1` (this request
 *   atomically won the claim) do we proceed to the user write.
 *
 *   Atomicity is preserved: if anything throws between the token claim
 *   and the user write, the entire transaction rolls back — the token
 *   is NOT consumed and the user is NOT verified. The user can retry.
 *
 * CONCURRENCY:
 *   - The atomic claim is `updateMany WHERE id = row.id AND consumedAt
 *     IS NULL AND expiresAt > now()`. Two concurrent requests with the
 *     same valid token will race: exactly one returns `count=1` (OK
 *     or ALREADY_VERIFIED depending on prior user state), the other
 *     returns `count=0` (surfaced as ALREADY_CONSUMED — the idempotent
 *     outcome, NO user write fires).
 *   - The `emailVerifiedAt` write is `updateMany WHERE emailVerifiedAt
 *     IS NULL` — idempotent. If a concurrent request already set it,
 *     this is a no-op with `count=0`, surfaced as ALREADY_VERIFIED.
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

  // ----- INTERACTIVE TRANSACTION -----
  // Why interactive (not array-form)? In Prisma `$transaction([...])` (array
  // form), an `updateMany` that matches 0 rows is NOT an error — it returns
  // `{ count: 0 }` and the next operation in the array STILL executes. That
  // means if the token claim loses its race (concurrent consume, or token
  // invalidated by a fresh `issueVerificationToken` between lookup and
  // claim, or token just expired between lookup and claim), the user
  // `emailVerifiedAt` write would STILL fire — verifying the user through
  // a token that was not actually claimable. That violates the identity
  // invariant.
  //
  // The interactive form `db.$transaction(async (tx) => { ... })` lets us
  // branch on `claim.count`: if the claim returned 0 rows, we return early
  // WITHOUT writing emailVerifiedAt. Only when `claim.count === 1` (this
  // request atomically won the claim) do we proceed to the user write.
  //
  // Atomicity: if anything throws between the token claim and the user
  // write, the entire transaction rolls back — the token is NOT consumed
  // and the user is NOT verified. The user can retry.
  return db.$transaction(async (tx) => {
    // (1) Inspect the token row inside the transaction. The lookup is
    //     authoritative for our disambiguation (NOT_FOUND / EXPIRED /
    //     ALREADY_CONSUMED). The actual claim below re-asserts the
    //     conditions atomically.
    const row = await tx.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, consumedAt: true, expiresAt: true },
    })

    if (!row) return { result: 'NOT_FOUND' as const }
    if (row.consumedAt) return { result: 'ALREADY_CONSUMED' as const, userId: row.userId }
    if (row.expiresAt <= now) return { result: 'EXPIRED' as const, userId: row.userId }

    // (2) Atomic claim — only one concurrent request can win.
    //     The `where` clause re-asserts `consumedAt IS NULL` AND
    //     `expiresAt > now`, so a concurrent request that
    //     consumed / invalidated / expired the token between the
    //     findUnique above and this updateMany will cause `count=0`
    //     here — even though the findUnique said the token was valid.
    const claim = await tx.emailVerificationToken.updateMany({
      where: { id: row.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    })

    // (3) CRITICAL GATE — if the claim did not match exactly 1 row, the
    //     token was NOT claimed by this request. DO NOT write
    //     `emailVerifiedAt`. This is the invariant that the array-form
    //     `$transaction` could NOT enforce (because `count=0` was not an
    //     error in the array form, the next op would still execute).
    if (claim.count !== 1) {
      return { result: 'ALREADY_CONSUMED' as const, userId: row.userId }
    }

    // (4) We won the claim. Now idempotently set `emailVerifiedAt`.
    //     `where emailVerifiedAt IS NULL` ensures idempotency: if the
    //     user was already verified via a different path (e.g. Google
    //     OAuth), this updateMany returns `count=0` and we surface
    //     ALREADY_VERIFIED with the authoritative prior timestamp.
    const userWrite = await tx.user.updateMany({
      where: { id: row.userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: now },
    })

    if (userWrite.count === 1) {
      return { result: 'OK' as const, userId: row.userId, emailVerifiedAt: now }
    }

    // userWrite.count === 0 → user was already verified before this tx.
    // Read the authoritative `emailVerifiedAt` back to return to caller.
    const userAfter = await tx.user.findUnique({
      where: { id: row.userId },
      select: { emailVerifiedAt: true },
    })
    return {
      result: 'ALREADY_VERIFIED' as const,
      userId: row.userId,
      emailVerifiedAt: userAfter?.emailVerifiedAt ?? null,
    }
  })
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
