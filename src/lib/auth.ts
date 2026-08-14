import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const SESSION_COOKIE = 'anima_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

// ============================================================================
// AuthError — structured auth error, mirrors the OrderError pattern.
//
// SECURITY CONTRACT:
//   throw new AuthError('UNAUTHENTICATED')  → HTTP 401, code='UNAUTHENTICATED'
//   throw new AuthError('FORBIDDEN')        → HTTP 403, code='FORBIDDEN'
//
// `handleAuthError(e)` returns a NextResponse if e is an AuthError (so route
// handlers can `return handleAuthError(e) ?? fallbackHandler(e)`), or null if
// e is NOT an AuthError (caller should treat as 500 / unexpected).
//
// Why this exists: every /api/admin/* route previously did
//   if (e.message === 'UNAUTHORIZED' || e.message === 'FORBIDDEN') return 403
// which (1) mapped BOTH unauthenticated and forbidden to 403 (task spec point
// 3 requires 401 vs 403 to be distinct) and (2) was a fragile string-equality
// check that would silently break if the message text ever changed. AuthError
// carries the structured `{ status, code }` so the contract is enforced by
// the type system instead of by string conventions.
// ============================================================================

export type AuthErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN'

export class AuthError extends Error {
  readonly status: number
  readonly code: AuthErrorCode
  constructor(code: AuthErrorCode) {
    super(code)
    this.name = 'AuthError'
    this.code = code
    this.status = code === 'UNAUTHENTICATED' ? 401 : 403
  }
}

/**
 * If `e` is an AuthError, returns a NextResponse with the structured
 * `{ error, code }` body and the correct HTTP status (401 or 403).
 * Otherwise returns null — the caller is responsible for handling the
 * non-auth error (typically a 500 fallback).
 *
 * Usage in a route handler:
 *   try { ... } catch (e) {
 *     const authRes = handleAuthError(e)
 *     if (authRes) return authRes
 *     console.error('Unexpected error:', e)
 *     return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
 *   }
 */
export function handleAuthError(e: unknown): NextResponse | null {
  if (e instanceof AuthError) {
    return NextResponse.json(
      { error: 'Tidak diizinkan', code: e.code },
      { status: e.status }
    )
  }
  // Backwards-compat: still recognize the legacy bare Error('UNAUTHORIZED')
  // / Error('FORBIDDEN') pattern from before the AuthError migration, so
  // that any code path that still throws the old form continues to be
  // handled correctly. New code should throw `new AuthError(...)` instead.
  if (e instanceof Error) {
    if (e.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'Tidak diizinkan', code: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }
    if (e.message === 'FORBIDDEN') {
      return NextResponse.json(
        { error: 'Tidak diizinkan', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }
  }
  return null
}

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
    throw new AuthError('UNAUTHENTICATED')
  }
  return user
}

export async function requireAdmin() {
  const user = await requireAuth()
  if (user.role !== 'ADMIN') {
    throw new AuthError('FORBIDDEN')
  }
  return user
}

// ============================================================================
// logAuthError — auth-route error logger with production sanitization.
//
// SECURITY CONTRACT:
//   - In PRODUCTION: logs ONLY `{ event, status }`. NEVER logs `e.message`,
//     `e.constructor.name`, `e.stack`, Prisma error code, or any other
//     derived string from the error object. Prisma errors can include SQL
//     fragments, constraint names, field names, and even connection-string
//     fragments in `e.message` — those must never reach production logs
//     readable by ops or by log-aggregation sidecars.
//   - In DEVELOPMENT: logs the event + constructor name + a length-capped
//     message string so engineers can debug the underlying Prisma/DB error.
//
// `event` is a STABLE label chosen by the caller (e.g. 'Login error',
// 'Register error'). It is safe to log because it does not depend on user
// input or runtime data.
//
// Usage:
//   } catch (e) {
//     logAuthError('Login error', e)
//     return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
//   }
// ============================================================================
export function logAuthError(event: string, e: unknown, status = 500): void {
  if (process.env.NODE_ENV === 'production') {
    // Production: only the stable event label + HTTP status. No derived
    // strings from the error object. This is the security boundary — even
    // if a Prisma error carries a connection-string fragment in its
    // message field, that fragment never reaches the log stream.
    console.error({ event, status })
    return
  }
  // Development: verbose logging for debugging. The 200-char cap matches
  // the previous behavior so dev tooling that parses these logs keeps
  // working.
  const errId = e instanceof Error ? e.constructor.name : typeof e
  const errMsg = e instanceof Error ? e.message : String(e)
  console.error(`${event}:`, { id: errId, message: errMsg.slice(0, 200) })
}
