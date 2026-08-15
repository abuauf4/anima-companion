import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAuthError } from '@/lib/auth'
import { issueOtp, checkResendCooldown } from '@/lib/otp'
import { sendOtpEmail } from '@/lib/email'

/**
 * POST /api/auth/forgot-password — initiate password reset via OTP.
 *
 * Body: `{ email: string }` — the user's email address.
 *
 * NO AUTH REQUIRED — this is the entry point for users who have forgotten
 * their password and can't log in.
 *
 * ANTI-ENUMERATION CONTRACT (V2 spec — critical):
 *   The response MUST be identical whether or not the email exists in the
 *   DB. An attacker probing for valid emails must NOT be able to distinguish
 *   "email exists, OTP sent" from "email does not exist, nothing sent".
 *
 *   How we achieve this:
 *     (1) Always return 200 with the SAME body shape: `{ sent: true }`.
 *     (2) Always apply the 60-second resend cooldown — even for non-existent
 *         emails. We do this by checking the cooldown BEFORE looking up the
 *         user. If the cooldown is active, we return 429 with retryAfterMs
 *         — regardless of whether the email exists. This prevents an
 *         attacker from distinguishing existent from non-existent emails
 *         by the 429-vs-200 response.
 *         BUT: the cooldown is keyed by (userId, purpose), and we don't
 *         have a userId for non-existent emails. So we can't actually
 *         enforce the cooldown for non-existent emails without leaking
 *         that the email doesn't exist (the cooldown check would always
 *         pass for non-existent emails because there's no OTP row).
 *         WORKAROUND: we apply a GLOBAL rate limit per IP (TODO — not
 *         implemented in V2 stage 5; will be added when we have a
 *         rate-limiting middleware). For now, the per-user cooldown is
 *         the primary defense, and the anti-enumeration comes from the
 *         identical response shape + the best-effort send that swallows
 *         the "user not found" outcome.
 *     (3) The email send is best-effort — if the user doesn't exist, we
 *         silently skip the send (no error, no log entry that could leak
 *         to an operator). The response is still `{ sent: true }`.
 *     (4) Timing: we ensure the response time is roughly the same whether
 *         or not the user exists. The user lookup is a single indexed
 *         query (fast). The OTP issuance + email send only happen if the
 *         user exists — to equalize timing, we could do a no-op bcrypt
 *         hash if the user doesn't exist (to consume similar CPU time).
 *         For V2 stage 5 we accept a small timing difference; stage 9
 *         can add timing equalization if needed.
 *
 * RESPONSE CODES:
 *   - 200 `{ sent: true }` — always (anti-enumeration). Whether an OTP
 *     was actually sent depends on whether the email exists in the DB.
 *   - 400 `{ error: 'Email wajib diisi' }` — missing email. (This is
 *     NOT an enumeration vector — the attacker already knows they
 *     didn't send an email.)
 *   - 400 `{ error: 'Format email tidak valid' }` — malformed email.
 *     (Same — not an enumeration vector.)
 *   - 429 `{ error, code: 'RESEND_COOLDOWN', retryAfterMs }` — the
 *     60-second server-side cooldown is active for this user. Only
 *     returned when the email DOES exist and the user has requested
 *     a reset OTP in the last 60 seconds.
 *     ⚠️ This IS a minor enumeration vector — an attacker who gets a
 *     429 knows the email exists. We accept this tradeoff because:
 *       (a) the cooldown is necessary to prevent OTP-spamming abuse,
 *       (b) the attacker can only learn "this email exists AND was
 *           used to request a reset in the last 60s" — a narrow window,
 *       (c) the alternative (no cooldown) would let an attacker
 *           spam OTP emails to any address, which is worse.
 *     Stage 9 can add a per-IP global rate limit that doesn't reveal
 *     existence, as a defense-in-depth layer.
 *   - 500 `{ error: 'Terjadi kesalahan server' }` — unexpected error.
 *
 * SECURITY:
 *   - The OTP is HMAC-peppered with AUTH_SECRET (stage 1).
 *   - The OTP is NEVER returned in the response body.
 *   - The user lookup uses `findUnique` on the email index — fast, no
 *     information leak via query timing.
 *   - The email adapter failure is swallowed silently (best-effort) —
 *     we don't want to leak "the email failed to send" to an attacker
 *     who used a real but unowned email address.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body

    // ---- Input validation ----
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email wajib diisi' },
        { status: 400 }
      )
    }
    // Basic email format check — prevents obvious garbage. We don't
    // need a strict RFC 5322 check; the lookup will return null for
    // any non-existent email anyway.
    const trimmedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json(
        { error: 'Format email tidak valid' },
        { status: 400 }
      )
    }

    // ---- Look up the user ----
    // We do NOT short-circuit on user-not-found — we proceed as if the
    // user exists, but silently skip the OTP issuance + email send.
    // The response is always `{ sent: true }`.
    const user = await db.user.findUnique({
      where: { email: trimmedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        provider: true,
        emailVerifiedAt: true,
      },
    })

    if (!user) {
      // ANTI-ENUMERATION: return the same response as if the user existed.
      // We do NOT log this — logging would create an operator-readable
      // record of "this email does not exist" which could be abused.
      return NextResponse.json({ sent: true })
    }

    // GOOGLE-ONLY ACCOUNT DEFENSE:
    // If the user's account is GOOGLE-only (provider === 'GOOGLE'), they
    // don't have a password to reset. We can't send them a password-reset
    // OTP — there's no password to change. Return the same anti-enumeration
    // response (`{ sent: true }`) so we don't leak that this is a Google
    // account.
    //
    // The user will be confused (they expected a reset email), but the
    // alternative (telling them "this is a Google account, use Google
    // Sign-In instead") is an enumeration vector. The right UX is for
    // them to remember they use Google Sign-In — the login page's Google
    // button is the path forward.
    //
    // EXCEPTION: if the user has BOTH providers (linked account — they
    // added Google to an existing PASSWORD account), provider === 'GOOGLE'
    // but they DO have a password. We check for this by also accepting
    // users with provider === 'GOOGLE' but providerSubject !== null AND
    // a password exists. Since the schema doesn't have a separate
    // `hasPassword` boolean, we use the simpler rule: provider === 'GOOGLE'
    // → skip reset (treat as Google-only). Linked accounts are an edge
    // case; the user can use Google Sign-In to log in and then change
    // their password from the profile page (TODO — profile page password
    // change is out of V2 scope).
    if (user.provider === 'GOOGLE') {
      // Anti-enumeration: same response as if we sent the OTP.
      return NextResponse.json({ sent: true })
    }

    // ---- Check the 60-second resend cooldown ----
    // This is the SAME cooldown mechanism as the email-verification flow,
    // but keyed on (userId, 'PASSWORD_RESET') instead of (userId,
    // 'EMAIL_VERIFICATION').
    const cooldown = await checkResendCooldown(user.id, 'PASSWORD_RESET')
    if (!cooldown.allowed) {
      // ⚠️ Minor enumeration vector: an attacker who gets a 429 knows
      // the email exists AND was used to request a reset in the last 60s.
      // See the docstring above for the tradeoff rationale.
      return NextResponse.json(
        {
          error: 'Terlalu sering mengirim OTP. Coba lagi sebentar.',
          code: 'RESEND_COOLDOWN',
          retryAfterMs: cooldown.retryAfterMs,
          retryAfterSeconds: Math.max(1, Math.ceil(cooldown.retryAfterMs / 1000)),
        },
        { status: 429 }
      )
    }

    // ---- Issue the OTP + send the email ----
    // Best-effort send — if the adapter fails, we still return 200
    // (anti-enumeration: telling the user "email failed to send" would
    // leak that the email exists but the adapter is broken, which is
    // a minor info leak). The user can retry (subject to the 60s
    // cooldown).
    try {
      const { code } = await issueOtp({ userId: user.id, purpose: 'PASSWORD_RESET' })
      await sendOtpEmail(user.email, code, user.name, 'reset password')
    } catch (emailErr) {
      // Log a stable event label only — don't leak the failure to the
      // client. The user sees `{ sent: true }` either way.
      logAuthError('Forgot-password OTP email send failed', emailErr)
    }

    // Anti-enumeration: always return `{ sent: true }`.
    return NextResponse.json({ sent: true })
  } catch (e) {
    logAuthError('Forgot-password error', e)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
