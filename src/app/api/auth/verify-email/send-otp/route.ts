import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, handleAuthError, logAuthError } from '@/lib/auth'
import { issueOtp, checkResendCooldown, OTP_RESEND_COOLDOWN_MS } from '@/lib/otp'
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

    // Check the 60-second server-side resend cooldown BEFORE issuing.
    // This is the V2 improvement over V1 (which had no rate limit).
    const cooldown = await checkResendCooldown(user.id, 'EMAIL_VERIFICATION')
    if (!cooldown.allowed) {
      return NextResponse.json(
        {
          error: 'Terlalu sering mengirim OTP. Coba lagi sebentar.',
          code: 'RESEND_COOLDOWN',
          retryAfterMs: cooldown.retryAfterMs,
          // Round up to the nearest second for client display. Always >= 1
          // when allowed === false (because retryAfterMs > 0).
          retryAfterSeconds: Math.max(1, Math.ceil(cooldown.retryAfterMs / 1000)),
        },
        { status: 429 }
      )
    }

    // Issue a new OTP (invalidates previous unconsumed OTPs atomically).
    const { code, expiresAt, resendAvailableAt } = await issueOtp({
      userId: user.id,
      purpose: 'EMAIL_VERIFICATION',
    })

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
