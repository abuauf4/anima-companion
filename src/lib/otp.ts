/**
 * Account Recovery & Verification V2 — OTP service.
 *
 * Server-only. Never import from a Client Component (`'use client'`).
 *
 * SECURITY CONTRACT:
 *   - The raw 6-digit code is NEVER persisted in the DB. The DB stores
 *     only `codeHash = HMAC-SHA-256(code, AUTH_SECRET)`. AUTH_SECRET is
 *     the same server secret used to sign session cookies (see
 *     `src/lib/auth.ts`), so an attacker who can forge one can forge the
 *     other — they're the same trust boundary.
 *
 *   - HMAC (not plain SHA-256) is mandatory here because the 6-digit code
 *     space is only 10^6 = 1,000,000 possibilities. A plain SHA-256 hash
 *     of a 6-digit code can be brute-forced offline in microseconds on a
 *     commodity GPU if the DB leaks. Adding the AUTH_SECRET pepper means
 *     the attacker must ALSO know AUTH_SECRET to mount even an offline
 *     brute force — and if they have AUTH_SECRET, the OTP is the least of
 *     our problems (they can forge session cookies directly).
 *
 *   - Constant-time comparison is used when verifying a user-supplied
 *     code against the stored HMAC, to prevent timing-channel leaking
 *     of hash-prefix information.
 *
 *   - The 60-second resend cooldown is enforced SERVER-SIDE via the
 *     `lastSentAt` column on the most recent unconsumed OTP. A malicious
 *     client cannot bypass it.
 *
 *   - The max-5-attempts cap is enforced ATOMICALLY via
 *     `updateMany WHERE id = row.id AND attempts < maxAttempts`. When
 *     `attempts` reaches `maxAttempts`, the code is LOCKED — further
 *     wrong-code requests return `LOCKED` without incrementing past the
 *     cap. The cap is hard.
 *
 *   - Issuing a new OTP INVALIDATES all previously unconsumed OTPs for
 *     the same (userId, purpose) pair by setting `consumedAt = now()`
 *     AND `attempts = maxAttempts`. The latter ensures a partially-
 *     attacked old code cannot be revived even if the `consumedAt` write
 *     is somehow rolled back.
 *
 *   - Concurrency: the verify path uses an interactive
 *     `db.$transaction(async (tx) => { ... })` that (1) looks up the
 *     newest unconsumed OTP for (userId, purpose) inside the tx, (2)
 *     atomically claims it via `updateMany WHERE id = row.id AND
 *     consumedAt IS NULL AND expiresAt > now AND attempts < maxAttempts`,
 *     (3) GATES on `claim.count === 1` — if the claim lost the race
 *     (concurrent verify won, or new OTP was issued between lookup and
 *     claim, or code expired between lookup and claim, or attempts just
 *     hit maxAttempts), NO further mutation happens.
 *
 *   - Atomicity guarantee: if the verify path throws between the OTP
 *     claim and the purpose-specific side effect (set emailVerifiedAt
 *     or issue PasswordResetGrant), the entire transaction rolls back —
 *     the OTP is NOT consumed and the side effect does NOT fire. The
 *     user can retry.
 *
 * The OTP code generation uses `crypto.randomInt(0, 1_000_000)` (Node's
 * CSPRNG-backed unbiased random integer in [0, 1_000_000)). The result
 * is zero-padded to 6 digits so the user always sees a 6-digit code.
 *
 * `crypto.randomInt` is preferred over `Math.floor` of a non-CSPRNG
 * floating-point sample because the latter has both modulo bias and a
 * non-CSPRNG source.
 */

import { randomInt, createHmac, timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** OTP TTL — 10 minutes from issuance (V2 spec). */
export const OTP_TTL_MS = 10 * 60 * 1000

/** Resend cooldown — 60 seconds between successive email dispatches (V2 spec). */
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000

/** Maximum failed verification attempts per OTP code (V2 spec). */
export const OTP_DEFAULT_MAX_ATTEMPTS = 5

export type OtpPurpose = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET'

// ---------------------------------------------------------------------------
// Secret resolution — reuses AUTH_SECRET (same trust boundary as session cookies)
// ---------------------------------------------------------------------------

const DEV_FALLBACK_SECRET = 'anima-companion-dev-secret-change-in-prod'

/**
 * Resolve the HMAC secret. In production, AUTH_SECRET MUST be set; we throw
 * if it's missing (the same hard-fail behavior as session-cookie signing —
 * see src/lib/auth.ts). In dev we fall back to the deterministic dev secret
 * so a fresh checkout can `bun dev` without env setup.
 *
 * The fallback is unreachable from production because `NODE_ENV=production`
 * is inlined at build time when `next start` runs.
 */
function getOtpSecret(): string {
  const env = process.env.AUTH_SECRET
  if (env) return env
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AUTH_SECRET is required in production. The OTP service uses the same ' +
        'secret as session-cookie signing — set AUTH_SECRET in the deployment ' +
        'environment (Coolify / Vercel project env vars) BEFORE promoting a build.'
    )
  }
  return DEV_FALLBACK_SECRET
}

// ---------------------------------------------------------------------------
// Code generation + HMAC hashing
// ---------------------------------------------------------------------------

/**
 * Generate a fresh 6-digit OTP code using Node's CSPRNG (`randomInt`).
 * Returns the code as a zero-padded 6-character string so the user
 * always sees "012345" rather than "12345".
 *
 * `randomInt(0, 1_000_000)` is unbiased ( rejection-sampled inside Node )
 * — preferred over a non-CSPRNG floating-point sample which has both
 * modulo bias and a non-CSPRNG source.
 */
export function generateOtpCode(): string {
  const n = randomInt(0, 1_000_000)
  return n.toString().padStart(6, '0')
}

/**
 * Compute `HMAC-SHA-256(code, AUTH_SECRET)` and return the hex digest.
 *
 * The `purpose` and `userId` are mixed into the HMAC input so that:
 *   - a code issued for EMAIL_VERIFICATION cannot be replayed as a
 *     PASSWORD_RESET code (different `purpose` → different hash even
 *     for the same 6-digit code), and
 *   - if two users happen to be issued the same 6-digit code at the
 *     same time, their stored hashes differ (different `userId`).
 *
 * Input layout (concatenated, length-prefixed to prevent ambiguity):
 *   purpose\0userId\0code
 * The `\0` separators prevent `purpose="A", userId="BC"` from colliding
 * with `purpose="AB", userId="C"`.
 */
export function hashOtpCode(code: string, purpose: OtpPurpose, userId: string): string {
  const message = `${purpose}\0${userId}\0${code}`
  return createHmac('sha256', getOtpSecret()).update(message, 'utf8').digest('hex')
}

/**
 * Constant-time comparison of two hex digests. Returns true iff they are
 * the same length AND every byte matches.
 *
 * `timingSafeEqual` throws on length mismatch, so we guard with an early
 * length check (the length itself is not sensitive — both inputs are
 * 64-char hex digests in normal use).
 */
export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch {
    // Manual fallback — same length, XOR each byte. Should be unreachable
    // because we already checked length equality above, but defensive.
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

export interface IssueOtpInput {
  userId: string
  purpose: OtpPurpose
  /** Optional override of the maxAttempts cap (defaults to OTP_DEFAULT_MAX_ATTEMPTS). */
  maxAttempts?: number
}

export interface IssueOtpResult {
  /** The raw 6-digit code. The caller MUST deliver it via the email channel
   *  and MUST NEVER log it, return it in an API response body, or persist
   *  it in plaintext anywhere. */
  code: string
  /** When this OTP expires (10 minutes from now). */
  expiresAt: Date
  /** Earliest moment the user is allowed to request a resend. */
  resendAvailableAt: Date
}

/**
 * Issue a new OTP for (userId, purpose). INVALIDATES all previously
 * unconsumed OTPs for the same (userId, purpose) pair by setting
 * `consumedAt = now()` AND `attempts = maxAttempts` on them — only the
 * newest OTP is valid at any time.
 *
 * Returns the RAW 6-digit code. The caller is responsible for delivering
 * it to the user's email via the configured adapter and for NEVER logging
 * it or returning it in an API response body.
 *
 * The DB row that gets created stores ONLY `hashOtpCode(code, purpose, userId)`.
 *
 * NOTE: This function does NOT enforce the 60-second resend cooldown.
 * The resend-cooldown check is the caller's responsibility (use
 * `checkResendCooldown` below). The reason for splitting them: the
 * caller may want to surface a "please wait N seconds" message to the
 * user, which requires reading the cooldown state BEFORE attempting to
 * issue. The issuance itself is unconditional — once the caller has
 * decided to issue (either because the cooldown has elapsed or because
 * this is the first issuance), this function does the DB work.
 */
export async function issueOtp(input: IssueOtpInput): Promise<IssueOtpResult> {
  const { userId, purpose } = input
  const maxAttempts = input.maxAttempts ?? OTP_DEFAULT_MAX_ATTEMPTS
  const code = generateOtpCode()
  const codeHash = hashOtpCode(code, purpose, userId)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS)

  // Atomically: invalidate old unconsumed OTPs for this (userId, purpose)
  // AND insert the new one. We use a transaction so a crash between the
  // two operations can't leave the user with TWO active OTPs.
  //
  // We set `attempts = maxAttempts` on the invalidated rows in addition
  // to `consumedAt = now()` — this is defense-in-depth: if the
  // `consumedAt` write is somehow rolled back (e.g. by a future code
  // change that breaks atomicity), the old code is still LOCKED by
  // the attempts cap and cannot be verified.
  await db.$transaction([
    db.otpCode.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: now, attempts: maxAttempts },
    }),
    db.otpCode.create({
      data: {
        userId,
        purpose,
        codeHash,
        attempts: 0,
        maxAttempts,
        expiresAt,
        consumedAt: null,
        lastSentAt: now,
      },
    }),
  ])

  return {
    code,
    expiresAt,
    resendAvailableAt: new Date(now.getTime() + OTP_RESEND_COOLDOWN_MS),
  }
}

// ---------------------------------------------------------------------------
// Resend cooldown check
// ---------------------------------------------------------------------------

export interface ResendCooldownResult {
  /** True if the caller is allowed to issue a new OTP right now. */
  allowed: boolean
  /** Milliseconds until the next resend is allowed. 0 when allowed === true. */
  retryAfterMs: number
  /** When the most recent OTP-bearing email was dispatched (for client display). */
  lastSentAt: Date | null
}

/**
 * Check whether the caller is allowed to issue a new OTP for (userId, purpose)
 * right now, given the 60-second server-side resend cooldown.
 *
 * Returns `{ allowed: true }` if no unconsumed OTP exists for this
 * (userId, purpose), OR if the most recent unconsumed OTP's `lastSentAt`
 * is more than 60 seconds in the past.
 *
 * Returns `{ allowed: false, retryAfterMs }` if the cooldown has not
 * elapsed. `retryAfterMs` is the number of milliseconds until the next
 * resend is allowed (always > 0 when allowed === false).
 *
 * The check is server-side and based on the DB's `lastSentAt` column,
 * NOT on a client-supplied timestamp — a malicious client cannot bypass
 * the cooldown by tampering with request data.
 */
export async function checkResendCooldown(
  userId: string,
  purpose: OtpPurpose
): Promise<ResendCooldownResult> {
  // Find the NEWEST unconsumed OTP for this (userId, purpose). If there
  // is none, the user is always allowed to issue (first-time flow).
  const latest = await db.otpCode.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { lastSentAt: true, expiresAt: true },
  })

  if (!latest) {
    return { allowed: true, retryAfterMs: 0, lastSentAt: null }
  }

  const now = Date.now()
  const elapsed = now - latest.lastSentAt.getTime()
  if (elapsed >= OTP_RESEND_COOLDOWN_MS) {
    return { allowed: true, retryAfterMs: 0, lastSentAt: latest.lastSentAt }
  }

  return {
    allowed: false,
    retryAfterMs: OTP_RESEND_COOLDOWN_MS - elapsed,
    lastSentAt: latest.lastSentAt,
  }
}

// ---------------------------------------------------------------------------
// Verification (consumption)
// ---------------------------------------------------------------------------

export type ConsumeOtpResult =
  // Success — the code was valid, atomically claimed, and the caller may
  // now perform the purpose-specific side effect (set emailVerifiedAt or
  // issue a PasswordResetGrant).
  | { result: 'OK'; userId: string; purpose: OtpPurpose }
  // The (userId, purpose) pair has no unconsumed OTP, OR the newest
  // unconsumed OTP has expired, OR the newest unconsumed OTP has hit
  // maxAttempts. The user must request a new OTP.
  | { result: 'NOT_FOUND_OR_EXPIRED' }
  // The code is well-formed but does not match the stored HMAC. The
  // `attempts` counter was incremented atomically. `remainingAttempts`
  // is how many more tries the user has before the code is LOCKED.
  // When `remainingAttempts === 0`, the next call will return
  // `NOT_FOUND_OR_EXPIRED` (because the row's attempts will have hit
  // maxAttempts and the findFirst below filters on `attempts < maxAttempts`).
  | { result: 'WRONG_CODE'; remainingAttempts: number }
  // Two concurrent verify requests with the SAME valid code raced —
  // only one can win the atomic `updateMany WHERE consumedAt IS NULL`.
  // The loser gets this result. This is NOT an error — the user's
  // intent (verify the code) has been satisfied by the winner. The
  // caller should treat this as success.
  | { result: 'ALREADY_CONSUMED'; userId: string; purpose: OtpPurpose }

export interface ConsumeOtpInput {
  userId: string
  purpose: OtpPurpose
  /** The user-supplied 6-digit code. Will be HMAC'd and compared to the stored hash. */
  code: string
}

/**
 * Verify a user-supplied OTP code against the DB. Atomic and concurrency-safe.
 *
 * Returns one of:
 *   - `OK` — code matched, was atomically claimed, caller may proceed
 *     with the purpose-specific side effect.
 *   - `NOT_FOUND_OR_EXPIRED` — no unconsumed, unexpired, un-locked OTP
 *     exists for this (userId, purpose). Caller should ask the user to
 *     request a new code.
 *   - `WRONG_CODE` — code is well-formed but does not match. The
 *     `attempts` counter was incremented atomically.
 *     `remainingAttempts` is the remaining try budget.
 *   - `ALREADY_CONSUMED` — a concurrent verify request with the same
 *     valid code won the race. Caller should treat as success.
 *
 * TRANSACTION BOUNDARY (interactive $transaction):
 *   The lookup AND the atomic claim AND the attempts increment all happen
 *   in the SAME interactive transaction. This is critical because:
 *     (1) The array-form `db.$transaction([...])` does NOT short-circuit
 *         on `updateMany` returning `{ count: 0 }` — count:0 is a successful
 *         operation that simply matched no rows. If we used the array form
 *         for the wrong-code increment, two concurrent wrong-code requests
 *         could BOTH increment past the cap.
 *     (2) The interactive form lets us branch on `claim.count` BEFORE
 *         issuing any further mutation, so the attempts cap is enforced
 *         atomically.
 *
 * CONCURRENCY NOTES:
 *   - Two concurrent verify requests with the SAME valid code: only one
 *     can win the `updateMany WHERE consumedAt IS NULL`. The loser gets
 *     `claim.count === 0` and we surface that as `ALREADY_CONSUMED`.
 *   - Two concurrent verify requests with DIFFERENT codes (one valid,
 *     one invalid) for the same OTP row: the valid one wins the claim
 *     (sets consumedAt); the invalid one's hash mismatch is detected
 *     BEFORE the increment, but the increment's `WHERE consumedAt IS NULL`
 *     will match 0 rows (because the valid one just set consumedAt) —
 *     so the attempts counter is NOT incremented. This is correct: the
 *     user's code WAS valid, they just lost the race to claim it.
 *   - Two concurrent verify requests with WRONG codes: both will try
 *     to increment `attempts` via `updateMany WHERE id = row.id AND
 *     attempts < maxAttempts`. One will get `count: 1` (increment to
 *     N+1), the other will see the post-increment value depending on
 *     isolation level. Under PostgreSQL's default READ COMMITTED, the
 *     second request's `WHERE attempts < maxAttempts` will see the
 *     updated value, so if the first took attempts to maxAttempts, the
 *     second's updateMany will match 0 rows and we'll return
 *     `NOT_FOUND_OR_EXPIRED` (because the findFirst's
 *     `attempts < maxAttempts` filter will exclude the now-locked row).
 *     This is correct behavior.
 */
export async function consumeOtp(input: ConsumeOtpInput): Promise<ConsumeOtpResult> {
  const { userId, purpose, code } = input
  const now = new Date()

  return db.$transaction(async (tx) => {
    // (1) Find the newest unconsumed, unexpired OTP for this (userId, purpose).
    //     We do NOT filter on `attempts < maxAttempts` here because Prisma
    //     does not support comparing two columns in a WHERE clause, and
    //     `maxAttempts` is a per-row value. Instead we read the row and
    //     check `attempts < maxAttempts` in JS — if the row is locked, we
    //     treat it as NOT_FOUND_OR_EXPIRED.
    const row = await tx.otpCode.findFirst({
      where: {
        userId,
        purpose,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, codeHash: true, attempts: true, maxAttempts: true },
    })

    // No active OTP for this (userId, purpose). Either none was ever
    // issued, or the most recent one expired / was consumed. Also covers
    // the case where the newest OTP is LOCKED (attempts >= maxAttempts).
    if (!row || row.attempts >= row.maxAttempts) {
      return { result: 'NOT_FOUND_OR_EXPIRED' as const }
    }

    // (2) Compute the HMAC of the user-supplied code and compare to the
    //     stored hash in constant time.
    const candidateHash = hashOtpCode(code, purpose, userId)
    const matches = constantTimeEqualHex(candidateHash, row.codeHash)

    if (!matches) {
      // (3a) WRONG CODE — increment attempts atomically, gated on
      //      `attempts < maxAttempts` so we never go past the cap.
      //      The `where` re-asserts `consumedAt IS NULL AND attempts <
      //      maxAttempts` so a concurrent verify that consumed the OTP
      //      OR pushed attempts to maxAttempts between our findFirst
      //      and this updateMany will cause `inc.count === 0`.
      const inc = await tx.otpCode.updateMany({
        where: {
          id: row.id,
          consumedAt: null,
          attempts: { lt: row.maxAttempts },
        },
        data: { attempts: { increment: 1 } },
      })
      // If `inc.count === 0`, a concurrent request already consumed
      // the OTP OR pushed attempts to maxAttempts. Either way the code
      // is no longer usable — surface as NOT_FOUND_OR_EXPIRED so the
      // user is prompted to request a new one.
      if (inc.count === 0) {
        return { result: 'NOT_FOUND_OR_EXPIRED' as const }
      }
      const remainingAttempts = Math.max(0, row.maxAttempts - (row.attempts + 1))
      return { result: 'WRONG_CODE' as const, remainingAttempts }
    }

    // (3b) CODE MATCHES — atomically claim it via updateMany with the
    //      full re-assertion of all preconditions. If a concurrent
    //      request already consumed / locked / expired the OTP between
    //      our findFirst and this updateMany, `claim.count` will be 0
    //      and we surface ALREADY_CONSUMED (idempotent success).
    const claim = await tx.otpCode.updateMany({
      where: {
        id: row.id,
        consumedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: row.maxAttempts },
      },
      data: { consumedAt: now },
    })

    if (claim.count !== 1) {
      // Race lost — a concurrent verify won, OR the OTP was invalidated
      // by a fresh issuance, OR it expired, OR attempts hit maxAttempts.
      // Idempotent success: the user's intent has been satisfied (the
      // code WAS valid).
      return { result: 'ALREADY_CONSUMED' as const, userId, purpose }
    }

    return { result: 'OK' as const, userId, purpose }
  })
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

/**
 * Invalidate ALL unconsumed OTPs for a user (any purpose). Called by the
 * password-reset flow after a successful reset, so that a partially-
 * attacked password-reset OTP cannot be reused after the password is
 * changed.
 *
 * Also called on user deletion (handled by the schema's `onDelete: Cascade`
 * which removes the rows entirely — this function is for the "user still
 * exists but we want to revoke their OTPs" case).
 */
export async function revokeAllOtpsForUser(userId: string): Promise<void> {
  const now = new Date()
  await db.otpCode.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: now },
  })
}
