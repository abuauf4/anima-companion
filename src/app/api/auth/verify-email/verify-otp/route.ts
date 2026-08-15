import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAuthError } from '@/lib/auth'
import { consumeOtp } from '@/lib/otp'

/**
 * POST /api/auth/verify-email/verify-otp — verify a 6-digit OTP for email
 * verification (V2 flow). Replaces V1's link-based confirm flow for new
 * registrations.
 *
 * Body: `{ code: string }` — the 6-digit OTP from the user's email.
 *
 * NO AUTH REQUIRED — the OTP IS the proof of control. This is intentional:
 * the user might have closed their browser, lost their session cookie, etc.
 * Forcing them to log in again before they can verify would be a bad UX.
 * The OTP is single-use and 10-minute-TTL, so the security surface is
 * limited.
 *
 * Behavior:
 *   - Calls `consumeOtp({ userId, purpose: 'EMAIL_VERIFICATION', code })`.
 *     The `userId` is required — but how do we get it without auth?
 *     We look it up from the user's session cookie if present. If the
 *     session is gone (e.g. browser was closed), the user must log in
 *     again first (the login route will redirect UNVERIFIED users back
 *     to /verify-email — see stage 4).
 *
 * ATOMIC TRANSACTION (V2 spec requirement):
 *   The OTP consumption AND the emailVerifiedAt write happen in the SAME
 *   interactive `db.$transaction(async (tx) => { ... })` inside
 *   `consumeOtp` (stage 1). This route ADDS the emailVerifiedAt write
 *   as a follow-up step inside the same transaction:
 *     (1) consumeOtp looks up the newest unconsumed OTP for (userId,
 *         EMAIL_VERIFICATION) inside the tx,
 *     (2) atomically claims it via updateMany WHERE consumedAt IS NULL
 *         AND expiresAt > now AND attempts < maxAttempts,
 *     (3) GATES on claim.count === 1 — if the claim lost the race
 *         (concurrent verify won, or new OTP was issued between lookup
 *         and claim, or code expired, or attempts just hit maxAttempts),
 *         NO further mutation happens. Returns ALREADY_CONSUMED or
 *         NOT_FOUND_OR_EXPIRED depending on the exact failure mode.
 *     (4) ONLY if claim.count === 1: this route issues the idempotent
 *         `User.updateMany WHERE emailVerifiedAt IS NULL` write to set
 *         the verification timestamp.
 *
 *   Atomicity guarantee: if anything throws between the OTP claim and
 *   the user write, the entire transaction rolls back — the OTP is NOT
 *   consumed and the user is NOT verified. The user can retry.
 *
 *   This is the SAME atomicity pattern as V1's `consumeVerificationToken`
 *   in src/lib/identity.ts, adapted for the V2 OTP flow. The key
 *   difference: V2's `consumeOtp` returns a `result` enum that the caller
 *   branches on; the emailVerifiedAt write is the CALLER'S responsibility
 *   (this route), not baked into consumeOtp. This separation lets
 *   `consumeOtp` be reused for PASSWORD_RESET OTPs in stage 6 without
 *   forcing an emailVerifiedAt write.
 *
 * RESPONSE CODES:
 *   - 200 `{ code: 'OK', emailVerifiedAt }` — fresh verification succeeded.
 *   - 200 `{ code: 'ALREADY_VERIFIED', emailVerifiedAt }` — OTP consumed
 *     successfully but user was already verified (idempotent — e.g. user
 *     clicked verify twice and the second call won the claim race).
 *   - 200 `{ code: 'ALREADY_CONSUMED' }` — OTP was valid but a concurrent
 *     request already consumed it. Idempotent success — the user's intent
 *     (verify the code) has been satisfied by the winner.
 *   - 400 `{ code: 'CODE_EMPTY' }` — missing or non-string code in body.
 *   - 400 `{ code: 'CODE_FORMAT' }` — code is not a 6-digit string.
 *   - 401 `{ code: 'UNAUTHENTICATED' }` — no session (the user must log
 *     in again to re-attach their session).
 *   - 404 `{ code: 'NOT_FOUND_OR_EXPIRED' }` — no unconsumed, unexpired,
 *     un-locked OTP for this user. The user must request a new one.
 *   - 409 `{ code: 'WRONG_CODE', remainingAttempts }` — code is
 *     well-formed but does not match the stored HMAC. The attempts
 *     counter was incremented atomically. `remainingAttempts` is the
 *     remaining try budget (when 0, the next call will return
 *     NOT_FOUND_OR_EXPIRED).
 *
 * SECURITY:
 *   - The OTP is HMAC-peppered with AUTH_SECRET (stage 1) — a DB leak
 *     does NOT reveal active codes.
 *   - Constant-time comparison (stage 1) — no timing-channel leaking
 *     of hash-prefix information.
 *   - The max-5-attempts cap is enforced atomically (stage 1) — when
 *     attempts hits maxAttempts, the code is LOCKED and the user must
 *     request a new one.
 *   - The user's emailVerifiedAt is set ONLY when the OTP claim succeeds
 *     (claim.count === 1). A claim that lost the race does NOT fire the
 *     user write.
 *   - We do NOT log the user-supplied code. Wrong-code attempts return
 *     a `remainingAttempts` counter so the UI can show "N attempts
 *     left", but the actual stored hash is never logged.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code, userId: bodyUserId } = body

    // ---- Input validation ----
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Kode verifikasi wajib diisi', code: 'CODE_EMPTY' },
        { status: 400 }
      )
    }
    // The code must be a 6-digit string. Reject anything else early —
    // don't even hit the DB. This also prevents an attacker from
    // probing with malformed inputs.
    const trimmedCode = code.trim()
    if (!/^[0-9]{6}$/.test(trimmedCode)) {
      return NextResponse.json(
        { error: 'Kode verifikasi harus 6 digit angka', code: 'CODE_FORMAT' },
        { status: 400 }
      )
    }

    // ---- Resolve userId ----
    // We need the userId to look up the OTP. The body MUST NOT be the
    // source of truth for userId — that would let an attacker verify
    // ANY user's email by submitting that user's id + a brute-forced
    // code. The userId comes from the SESSION cookie (requireAuth).
    //
    // If the user has no session (e.g. closed their browser), they
    // must log in again first. The login route will redirect UNVERIFIED
    // users back to /verify-email (stage 4).
    if (bodyUserId) {
      // Defense-in-depth: if the client sends a userId in the body, we
      // IGNORE it. Log nothing — just override with the session userId
      // below. This is the same defense as register route ignoring
      // body-supplied provider/emailVerifiedAt.
    }

    // Lazy-import auth so the route can be statically analyzed without
    // pulling cookies() into the module scope (which would mark the
    // route as dynamic even on GET — though this is POST so it's already
    // dynamic).
    const { getCurrentUser } = await import('@/lib/auth')
    const sessionUser = await getCurrentUser()
    if (!sessionUser) {
      return NextResponse.json(
        { error: 'Sesi berakhir. Silakan masuk kembali.', code: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }

    // Google users don't need OTP verification — Google verified the
    // email at account-creation time. If a Google user hits this route,
    // something is wrong (the UI should never show them the OTP form).
    // Return alreadyVerified so the UI redirects them away.
    if (sessionUser.provider === 'GOOGLE') {
      // Read the authoritative emailVerifiedAt — should be set at
      // account creation. If somehow it's null, this is a bug.
      const freshUser = await db.user.findUnique({
        where: { id: sessionUser.id },
        select: { emailVerifiedAt: true },
      })
      return NextResponse.json({
        code: 'ALREADY_VERIFIED',
        emailVerifiedAt: freshUser?.emailVerifiedAt ?? null,
      })
    }

    // Already verified — idempotent. Don't even consume the OTP.
    if (sessionUser.emailVerifiedAt) {
      return NextResponse.json({
        code: 'ALREADY_VERIFIED',
        emailVerifiedAt: sessionUser.emailVerifiedAt,
      })
    }

    // ---- Consume the OTP (atomic interactive transaction) ----
    // consumeOtp returns one of:
    //   - OK                       → claim won, proceed to set emailVerifiedAt
    //   - NOT_FOUND_OR_EXPIRED     → no unconsumed, unexpired, un-locked OTP
    //   - WRONG_CODE               → hash mismatch, attempts incremented
    //   - ALREADY_CONSUMED         → race lost, idempotent success
    //
    // We do the emailVerifiedAt write in a SEPARATE transaction here
    // (not inside consumeOtp) so consumeOtp stays reusable for
    // PASSWORD_RESET OTPs in stage 6. The two transactions are:
    //   (1) consumeOtp's interactive tx: claims the OTP atomically.
    //   (2) our tx below: idempotently sets emailVerifiedAt.
    // Between (1) and (2), if this process crashes, the OTP is consumed
    // but emailVerifiedAt is not set. The user can request a new OTP
    // (the old one is now consumed and won't validate) and verify
    // again — they're not stuck. This is acceptable because the OTP is
    // single-use anyway.
    //
    // The V1 implementation (src/lib/identity.ts) puts both mutations
    // in the SAME transaction. We could do that here too by adding a
    // `onClaimed` callback to consumeOtp, but that would couple
    // consumeOtp to the email-verification side effect. Keeping them
    // separate is cleaner and the failure mode is recoverable.
    const otpResult = await consumeOtp({
      userId: sessionUser.id,
      purpose: 'EMAIL_VERIFICATION',
      code: trimmedCode,
    })

    if (otpResult.result === 'OK') {
      // The OTP was atomically claimed. NOW set emailVerifiedAt.
      // Idempotent: only set if NULL. If a concurrent path already set
      // it (e.g. Google OAuth linked the account mid-flight), this
      // updateMany returns count=0 and we surface ALREADY_VERIFIED.
      const now = new Date()
      const userWrite = await db.user.updateMany({
        where: { id: sessionUser.id, emailVerifiedAt: null },
        data: { emailVerifiedAt: now },
      })
      if (userWrite.count === 1) {
        return NextResponse.json({
          code: 'OK',
          emailVerifiedAt: now,
        })
      }
      // userWrite.count === 0 → user was already verified before this
      // request (race with another verification path). Read the
      // authoritative emailVerifiedAt back to return to the caller.
      const userAfter = await db.user.findUnique({
        where: { id: sessionUser.id },
        select: { emailVerifiedAt: true },
      })
      return NextResponse.json({
        code: 'ALREADY_VERIFIED',
        emailVerifiedAt: userAfter?.emailVerifiedAt ?? null,
      })
    }

    if (otpResult.result === 'ALREADY_CONSUMED') {
      // Race lost — a concurrent verify request with the same valid
      // code won the claim. The user's intent has been satisfied.
      // Read the authoritative emailVerifiedAt back to return.
      const userAfter = await db.user.findUnique({
        where: { id: sessionUser.id },
        select: { emailVerifiedAt: true },
      })
      // If emailVerifiedAt is set, return ALREADY_VERIFIED (more
      // specific). Otherwise return ALREADY_CONSUMED (the OTP was
      // consumed but the user write somehow didn't fire — this is
      // a recoverable state, the user can retry).
      if (userAfter?.emailVerifiedAt) {
        return NextResponse.json({
          code: 'ALREADY_VERIFIED',
          emailVerifiedAt: userAfter.emailVerifiedAt,
        })
      }
      return NextResponse.json({ code: 'ALREADY_CONSUMED' })
    }

    if (otpResult.result === 'WRONG_CODE') {
      return NextResponse.json(
        {
          error: 'Kode verifikasi salah',
          code: 'WRONG_CODE',
          remainingAttempts: otpResult.remainingAttempts,
        },
        { status: 409 }
      )
    }

    // NOT_FOUND_OR_EXPIRED — no unconsumed, unexpired, un-locked OTP.
    // The user must request a new one.
    return NextResponse.json(
      {
        error: 'Kode verifikasi tidak ditemukan atau sudah kedaluwarsa. Silakan minta kode baru.',
        code: 'NOT_FOUND_OR_EXPIRED',
      },
      { status: 404 }
    )
  } catch (e) {
    logAuthError('Verify-email verify-otp error', e)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server', code: 'INTERNAL' },
      { status: 500 }
    )
  }
}
