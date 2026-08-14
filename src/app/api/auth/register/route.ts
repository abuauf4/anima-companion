import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createSession, logAuthError } from '@/lib/auth'

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
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        phone: phone || null,
        role: 'CUSTOMER',
      },
      select: { id: true, email: true, name: true, phone: true, role: true },
    })

    await db.cart.create({ data: { userId: user.id } })

    await createSession(user)
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
