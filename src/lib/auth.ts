import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

const SESSION_COOKIE = 'anima_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
const SECRET = process.env.AUTH_SECRET || 'anima-companion-dev-secret-change-in-prod'

// Simple HMAC-signed session token (JSON payload + signature)
// Format: base64url(payload).base64url(signature)

async function sign(payload: object): Promise<string> {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return `${body}.${Buffer.from(sig).toString('base64url')}`
}

async function verify(token: string): Promise<any | null> {
  try {
    const [body, sig] = token.split('.')
    if (!body || !sig) return null
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    const sigBuf = Buffer.from(sig, 'base64url')
    const valid = await crypto.subtle.verify('HMAC', key, sigBuf, new TextEncoder().encode(body))
    if (!valid) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (payload.exp && Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(user: { id: string; email: string; role: string }) {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  }
  const token = await sign(payload)
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
}

export async function destroySession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  const payload = await verify(token)
  if (!payload) return null
  const user = await db.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, phone: true, role: true },
  })
  return user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

export async function requireAdmin() {
  const user = await requireAuth()
  if (user.role !== 'ADMIN') {
    throw new Error('FORBIDDEN')
  }
  return user
}
