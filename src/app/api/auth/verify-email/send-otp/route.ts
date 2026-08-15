import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError, logAuthError } from '@/lib/auth'
import { issueOtp, OTP_RESEND_COOLDOWN_MS } from '@/lib/otp'
import { sendOtpEmail } from '@/lib/email'

/**
 * POST /api/auth/verify-email/send-otp — send (or resend) a 6-digit OTP
 * for email verification (V2 flow).
 *
 * Requires authentication (the user must be logged in to request an OTP
 * for their OWN address — we never send to an arbitrary email the caller
 * specifies).
 *
 * Behavior:
 *   - If the user is already verified (`emailVerifiedAt !== null`),
 *     returns 200 with `{ alreadyVerified: true }` and does NOT send
 *     another OTP. Idempotent — prevents spamming the user.
 *   - If the user is a GOOGLE user (`provider === 'GOOGLE'`), returns
 *     400 with `{ error: 'Google users do not need email verification' }`.
 *     Google verified the email at account-creation time; there's no
 *     flow for them to re-verify via OTP.
 *   - Otherwise, checks the 60-second server-side resend cooldown:
 *       `now - lastSentAt < 60s` on the most recent unconsumed OTP for
 *       this (userId, EMAIL_VERIFICATION) pair. If the cooldown has not
 *       elapsed, returns 429 with `{ error, retryAfterMs }` so the UI
 *       can show "coba lagi dalam N detik".
 *     If the cooldown HAS elapsed (or no unconsumed OTP exists — first
 *     time requesting), issues a fresh OTP (invalidates all previously
 *     unconsumed OTPs for this user — see issueOtp), sends it via the
 *     configured email adapter, and returns 200.
 *
 * SERVER-SIDE COOLDOWN:
 *   The 60-second cooldown is enforced SERVER-SIDE via the `lastSentAt`
 *   column on the most recent unconsumed OTP. A malicious client cannot
 *   bypass it by tampering with request data. The cooldown protects
 *   against OTP-spamming (an attacker who knows the user's email
 *   repeatedly triggering OTP emails) and against email-adapter rate
 *   limits.
 *
 * ANTI-ENUMERATION:
 *   This route requires auth, so there's no email-enumeration vector
 *   here. The forgot-password flow (stage 5) has the anti-enumeration
 *   requirement — see /api/auth/forgot-password/route.ts.
 *
 * SECURITY:
 *   - The OTP is NEVER returned in the response body. The only way to
 *     learn the OTP is via the email channel.
 *   - In dev, the developer can see the OTP in the server console.
 *   - In production, the email adapter sends the OTP via Resend (or
 *     refuses to send if EMAIL_PROVIDER is not configured).
 */
export async function POST(_req: NextRequest) {
  try {
    const user = await requireAuth()

    // Google users don't need to verify their email — Google already did.
    if (user.provider === 'GOOGLE') {
      return NextResponse.json(
        {
          error: 'Akun Google tidak perlu verifikasi email — email sudah diverifikasi oleh Google.',
          code: 'GOOGLE_USER_NO_VERIFICATION_NEEDED',
        },
        { status: 400 }
      )
    }

    // Already verified — idempotent no-op.
    if (user.emailVerifiedAt) {
      return NextResponse.json({
        alreadyVerified: true,
        emailVerifiedAt: user.emailVerifiedAt,
      })
    }

    // Account Recovery & Verification V2 — issue a new OTP atomically.
    //
    // `issueOtp` now does the cooldown check + invalidate-old + create-new
    // all inside a single `pg_advisory_xact_lock`-protected transaction.
    // This is the race-free contract: under 10 parallel requests, exactly
    // ONE will get `ISSUED` (and send the email), the other 9 will get
    // `COOLDOWN` (and NOT send any email). See `src/lib/otp.ts` for the
    // full serialization design.
    //
    // We NO LONGER call `checkResendCooldown` separately — that was the
    // root cause of the V2 QA Test 2 race (10 parallel callers could all
    // read `allowed: true` before any had committed their `issueOtp`).
    const outcome = await issueOtp({
      userId: user.id,
      purpose: 'EMAIL_VERIFICATION',
    })

    if (outcome.result === 'COOLDOWN') {
      // Cooldown still active — surface to the UI so it can show
      // "coba lagi dalam N detik". We did NOT insert a new OTP and we
      // MUST NOT send any email.
      return NextResponse.json(
        {
          error: 'Terlalu sering mengirim OTP. Coba lagi sebentar.',
          code: 'RESEND_COOLDOWN',
          retryAfterMs: outcome.retryAfterMs,
          // Round up to the nearest second for client display. Always >= 1
          // when result === 'COOLDOWN' (because retryAfterMs > 0).
          retryAfterSeconds: Math.max(1, Math.ceil(outcome.retryAfterMs / 1000)),
        },
        { status: 429 }
      )
    }

    // outcome.result === 'ISSUED' — we are the SOLE owner of the email-send
    // for this issuance. Losing concurrent callers received `COOLDOWN` and
    // did NOT send any email.
    const { code, expiresAt, resendAvailableAt } = outcome

    // Send the OTP via the configured email adapter.
    // Best-effort — if the adapter fails, we still return 200 with
    // `otpSent: false` so the UI can show a "kirim ulang" CTA. The
    // user can retry (subject to the 60-second cooldown).
    let otpSent = false
    let emailError = false
    try {
      await sendOtpEmail(user.email, code, user.name)
      otpSent = true
    } catch (emailErr) {
      // Log a stable event label only — the raw emailErr.message may
      // contain SMTP/Prisma error fragments that must not reach
      // production logs.
      logAuthError('Verify-email send-otp email send failed', emailErr)
      emailError = true
    }

    return NextResponse.json({
      sent: otpSent,
      // If the email adapter failed, surface this to the UI so it can
      // show a "kirim ulang" CTA immediately (rather than telling the
      // user to "check their email" when no email was sent).
      emailError,
      // Tell the client when this OTP expires and when the next resend
      // is allowed — the UI uses these to drive the countdown timer and
      // the "kirim ulang" button state.
      expiresAt,
      resendAvailableAt,
      // We do NOT return the raw OTP in the response. The only way to
      // learn the OTP is via the email channel.
      // In dev, the developer can see it in the server console.
      cooldownMs: OTP_RESEND_COOLDOWN_MS,
    })
  } catch (e) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    logAuthError('Verify-email send-otp error', e)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
