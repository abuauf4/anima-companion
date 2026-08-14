import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, handleAuthError, logAuthError } from '@/lib/auth'
import { issueVerificationToken } from '@/lib/identity'
import { sendVerificationEmail } from '@/lib/email'

/**
 * POST /api/auth/verify-email/request — send a verification email.
 *
 * Requires authentication (the user must be logged in to request a
 * verification email for their OWN address — we never send to an
 * arbitrary email the caller specifies).
 *
 * Behavior:
 *   - If the user is already verified (`emailVerifiedAt !== null`),
 *     returns 200 with `{ alreadyVerified: true }` and does NOT send
 *     another email. This is idempotent and prevents spamming the user.
 *   - If the user is a GOOGLE user (`provider === 'GOOGLE'`), returns
 *     400 with `{ error: 'Google users do not need email verification' }`.
 *     Google verified the email at account-creation time; there's no
 *     flow for them to re-verify via password-style tokens.
 *   - Otherwise, issues a new verification token (invalidates all
 *     previously unconsumed tokens for the user — see
 *     issueVerificationToken), sends the verification email via the
 *     configured adapter, and returns 200.
 *
 * Rate-limiting is NOT implemented in V1 (it's a V2 concern, explicitly
 * listed in the task as "rate limiting audit only — do not implement").
 * The 24h token TTL + single-use consumption is the primary defense.
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

    // Issue a new token (invalidates previous unconsumed tokens).
    const rawToken = await issueVerificationToken(user.id)

    // Send the verification email via the configured adapter.
    // In dev with no EMAIL_PROVIDER set, this logs to the console.
    // In production with no EMAIL_PROVIDER set, the adapter logs a
    // CONFIG-MISSING error — see src/lib/email.ts.
    await sendVerificationEmail(user.email, rawToken, user.name)

    return NextResponse.json({
      sent: true,
      // We do NOT return the raw token in the response. The only way to
      // learn the token is via the email channel.
      // In dev, the developer can see it in the server console.
    })
  } catch (e) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    logAuthError('Verify-email request error', e)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
