import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { comparePassword, createSession, logAuthError } from '@/lib/auth'

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

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
    }

    await createSession(safeUser)
    return NextResponse.json({ user: safeUser })
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
