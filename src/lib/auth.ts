import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

const SESSION_COOKIE = 'anima_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

// Resolve the session-signing secret with hard production safety.
//
// SECURITY GUARANTEE:
// - In production, AUTH_SECRET MUST be set via environment. If missing, the
//   first auth operation (sign OR verify) will throw — the server will 500
//   on login/session-check rather than silently issue forgeable tokens.
// - In non-production (dev/test/preview/local), we fall back to a
//   deterministic dev-only secret so a fresh checkout can run `bun dev`
//   without env setup. This fallback is unreachable from production because
//   `process.env.NODE_ENV` is set to 'production' by `next start`.
//
// WHY LAZY (function, not module-load IIFE):
// `next build` imports server modules to collect page data. A module-load
// throw would break the build itself. Deferring the check to first
// sign/verify call means the build succeeds, but every runtime auth
// operation in production still enforces the secret. The dev fallback
// string is therefore impossible to reach from a production server.
//
// AUTH_SECRET is intentionally NOT prefixed with NEXT_PUBLIC_ — it stays
// server-side and is never inlined into the client bundle.
const DEV_FALLBACK_SECRET = 'anima-companion-dev-secret-change-in-prod'
function getSecret(): string {
  const env = process.env.AUTH_SECRET
  if (env) return env
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AUTH_SECRET is required in production. Set it in your deployment environment (e.g. Coolify / Vercel project env vars).'
    )
  }
  return DEV_FALLBACK_SECRET
}

// Simple HMAC-signed session token (JSON payload + signature)
// Format: base64url(payload).base64url(signature)

async function sign(payload: object): Promise<string> {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
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
      new TextEncoder().encode(getSecret()),
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
