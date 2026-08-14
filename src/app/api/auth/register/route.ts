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
    // request another verification email from the profile page. We log
    // the failure but don't fail the registration.
    try {
      const rawToken = await issueVerificationToken(user.id)
      await sendVerificationEmail(user.email, rawToken, user.name)
    } catch (emailErr) {
      // Log but don't fail registration — the user can request another
      // verification email from the profile page.
      console.error('[register] Failed to send verification email:', emailErr instanceof Error ? emailErr.message : emailErr)
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
