import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createSession, logAuthError } from '@/lib/auth'
import { issueVerificationToken } from '@/lib/identity'
import { sendVerificationEmail } from '@/lib/email'

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
    // The user is created UNVERIFIED. The verification email is sent
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

    // Issue a verification token + send the verification email. Best-effort
    // — if the email adapter fails (e.g. production without EMAIL_PROVIDER
    // configured), the user is still registered and logged in; they can
    // request another verification email from the profile page's "Kirim
    // ulang" button (POST /api/auth/verify-email/request). We log the
    // failure via `logAuthError` (production: stable event label only —
    // never logs the raw email-adapter error message which could include
    // SMTP config fragments or PII) but don't fail the registration.
    //
    // RECOVERABILITY CONTRACT (Verified Identity V1 cleanup):
    //   Account is created with emailVerifiedAt = null. User is logged in.
    //   Profile page shows "Belum terverifikasi" badge + "Kirim ulang"
    //   button. Clicking it calls POST /api/auth/verify-email/request,
    //   which issues a fresh token (invalidating the un-sent previous
    //   one) and retries delivery. The user is NEVER trapped in a
    //   "registered but unrecoverable" state — even if the initial
    //   delivery fails entirely, the resend path is always available
    //   for as long as the account exists.
    try {
      const rawToken = await issueVerificationToken(user.id)
      await sendVerificationEmail(user.email, rawToken, user.name)
    } catch (emailErr) {
      // Don't fail registration — log a stable event label only. The raw
      // `emailErr.message` may contain SMTP/Prisma error fragments that
      // must not reach production logs. `logAuthError` handles the prod
      // sanitization (only `{ event, status }` in production; verbose in
      // development for debugging).
      logAuthError('Register verification email send failed', emailErr)
    }

    await createSession({
      id: user.id,
      email: user.email,
      role: user.role,
    })
    return NextResponse.json({ user })
  } catch (e) {
    // SECURITY: see login route — same sanitization applies. In production
    // we log ONLY a stable event label + HTTP status; in development we log
    // constructor name + length-capped message. See `logAuthError()` in
    // src/lib/auth.ts for the full contract.
    logAuthError('Register error', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
