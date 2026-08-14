import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createSession } from '@/lib/auth'

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
    // SECURITY: see login route — same sanitization applies. We log only
    // the error class name + a length-capped message string. Never the
    // raw error object or stack trace, because Prisma errors can carry
    // query SQL + connection fragments.
    const errId = e instanceof Error ? e.constructor.name : typeof e
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error('Register error:', { id: errId, message: errMsg.slice(0, 200) })
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
