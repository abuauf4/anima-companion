import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { comparePassword, createSession, logAuthError } from '@/lib/auth'
import { issueOtp } from '@/lib/otp'
import { sendOtpEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password wajib diisi' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } })
    if (!user) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      )
    }

    const valid = await comparePassword(password, user.password)
    if (!valid) {
      return NextResponse.json(
        { error: 'Email atau password salah' },
        { status: 401 }
      )
    }

    // Verified Identity V1 — include `provider`, `providerSubject`, and
    // `emailVerifiedAt` in the response. These are READ-ONLY fields; the
    // client cannot modify them via this route (they're set ONLY by the
    // register / verify-email / Google-callback routes).
    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      provider: user.provider,
      providerSubject: user.providerSubject,
      emailVerifiedAt: user.emailVerifiedAt,
    }

    await createSession(safeUser)

    // Account Recovery & Verification V2 — if the user is a PASSWORD user
    // with emailVerifiedAt === null, the client MUST redirect them to
    // /verify-email before they can do anything else. We:
    //   (1) set `requiresVerification: true` in the response so the client
    //       knows to redirect,
    //   (2) issue a fresh OTP (best-effort — if the email adapter fails,
    //       the user can resend from /verify-email) so the user can
    //       verify immediately without having to click "Kirim ulang".
    //
    // ADMIN users bypass this redirect — admins have other auth pathways
    // (they were created with emailVerifiedAt set by a seed script or by
    // a previous V1 verification) and we don't want to lock them out of
    // the admin panel. If an admin somehow has emailVerifiedAt === null
    // (e.g. a fresh admin seed), they can still log in — the redirect
    // is for CUSTOMER users only.
    //
    // GOOGLE users always have emailVerifiedAt set at account-creation
    // time (Google verified the email), so this branch is unreachable
    // for them.
    let requiresVerification = false
    let otpSent = false
    if (
      user.provider === 'PASSWORD' &&
      !user.emailVerifiedAt &&
      user.role !== 'ADMIN'
    ) {
      requiresVerification = true
      // Issue a fresh OTP (invalidates any previous unconsumed OTP for
      // this user). Best-effort send — if the adapter fails, the user
      // is logged in and will be redirected to /verify-email where they
      // can click "Kirim ulang".
      try {
        const { code } = await issueOtp({ userId: user.id, purpose: 'EMAIL_VERIFICATION' })
        await sendOtpEmail(user.email, code, user.name)
        otpSent = true
      } catch (emailErr) {
        // Don't fail login — log a stable event label only. The user is
        // logged in and will be redirected to /verify-email.
        logAuthError('Login verification OTP send failed', emailErr)
      }
    }

    return NextResponse.json({ user: safeUser, requiresVerification, otpSent })
  } catch (e) {
    // SECURITY: do NOT log the raw error object in production. Prisma errors
    // can include SQL fragments, constraint names, field names, and even
    // connection-string fragments in `e.message`. In production we log
    // ONLY a stable event label + HTTP status. In development we log the
    // constructor name + a length-capped message for debugging.
    // See `logAuthError()` in src/lib/auth.ts for the full contract.
    logAuthError('Login error', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
