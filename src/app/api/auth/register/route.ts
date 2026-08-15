import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createSession, logAuthError } from '@/lib/auth'
import { issueOtp } from '@/lib/otp'
import { sendOtpEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, name, phone } = body

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, dan nama wajib diisi' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password minimal 6 karakter' },
        { status: 400 }
      )
    }

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar' },
        { status: 409 }
      )
    }

    const hashedPassword = await hashPassword(password)
    // Verified Identity V1 — explicit provider + emailVerifiedAt fields:
    //   - provider: 'PASSWORD' (hardcoded; NEVER read from body).
    //   - emailVerifiedAt: null (user must verify via the email flow
    //     before this is set).
    //   - providerSubject: null (only set for GOOGLE users).
    // The user is created UNVERIFIED. The verification OTP is sent
    // immediately after creation so the user can verify before they
    // forget about it.
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        phone: phone || null,
        role: 'CUSTOMER',
        provider: 'PASSWORD',
        providerSubject: null,
        emailVerifiedAt: null,
      },
      select: {
        id: true, email: true, name: true, phone: true, role: true,
        provider: true, emailVerifiedAt: true,
      },
    })

    await db.cart.create({ data: { userId: user.id } })

    // Account Recovery & Verification V2 — issue a 6-digit OTP (NOT the
    // V1 32-byte link token) and send it via the email adapter.
    //
    // The OTP is HMAC-peppered with AUTH_SECRET (see src/lib/otp.ts),
    // 10-minute TTL, single-use, max 5 verification attempts. The user
    // enters the code into the /verify-email form (NOT a click-link flow).
    //
    // Best-effort — if the email adapter fails (e.g. production without
    // EMAIL_PROVIDER configured), the user is still registered and
    // logged in; they can request another OTP from the /verify-email
    // page's "Kirim ulang" button (POST /api/auth/verify-email/send-otp).
    // We log the failure via `logAuthError` (production: stable event
    // label only — never logs the raw email-adapter error message which
    // could include SMTP config fragments or PII) but don't fail the
    // registration.
    //
    // RECOVERABILITY CONTRACT:
    //   Account is created with emailVerifiedAt = null. User is logged in
    //   and immediately redirected to /verify-email. The /verify-email
    //   page shows an OTP input form + a "Kirim ulang" button. Clicking
    //   it calls POST /api/auth/verify-email/send-otp, which issues a
    //   fresh OTP (invalidating the previous one) and retries delivery,
    //   subject to the 60-second server-side resend cooldown. The user
    //   is NEVER trapped in a "registered but unrecoverable" state —
    //   even if the initial delivery fails entirely, the resend path is
    //   always available for as long as the account exists.
    let otpSent = false
    try {
      const { code } = await issueOtp({ userId: user.id, purpose: 'EMAIL_VERIFICATION' })
      await sendOtpEmail(user.email, code, user.name)
      otpSent = true
    } catch (emailErr) {
      // Don't fail registration — log a stable event label only. The raw
      // `emailErr.message` may contain SMTP/Prisma error fragments that
      // must not reach production logs. `logAuthError` handles the prod
      // sanitization (only `{ event, status }` in production; verbose in
      // development for debugging).
      logAuthError('Register OTP email send failed', emailErr)
    }

    await createSession({
      id: user.id,
      email: user.email,
      role: user.role,
    })
    // Tell the client that an OTP was sent (so the UI can show a "cek
    // email" message) — but never include the OTP itself in the response.
    // If otpSent is false, the UI shows a "kirim ulang" CTA immediately.
    return NextResponse.json({ user, otpSent })
  } catch (e) {
    // SECURITY: see login route — same sanitization applies. In production
    // we log ONLY a stable event label + HTTP status; in development we log
    // constructor name + length-capped message. See `logAuthError()` in
    // src/lib/auth.ts for the full contract.
    logAuthError('Register error', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
