import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { comparePassword, createSession } from '@/lib/auth'

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
    // SECURITY: do NOT log the raw error object. Prisma errors can include
    // the full SQL query and connection-string fragments in `e.message` /
    // `e.stack`, which could end up in server logs readable by ops or by
    // log-aggregation sidecars. We log only a stable identifier + the
    // error class name + the message string (Prisma's `code` is fine to
    // log because it's a stable P-prefixed code like P2002). We never log
    // the raw error object, e.stack, or e.query.
    const errId = e instanceof Error ? e.constructor.name : typeof e
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error('Login error:', { id: errId, message: errMsg.slice(0, 200) })
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
