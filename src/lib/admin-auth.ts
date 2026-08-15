// ============================================================================
// Admin Realm Auth — V1 Developer RBAC.
//
// COMPLETELY SEPARATE from customer auth (src/lib/auth.ts). The two realms
// have DIFFERENT:
//   - Cookie names: `anima_admin_session` vs `anima_session`
//   - DB tables: `AdminUser` vs `User`
//   - Auth helpers: requireAdminSession / requireDeveloper / requirePermission
//     vs requireAuth / requireAdmin
//   - Login flows: /admin/login (username+password) vs /login (email+password
//     + OTP + Google OAuth)
//
// SECURITY CONTRACT:
//   - The admin session cookie is HMAC-SHA-256 signed with the SAME
//     AUTH_SECRET as the customer session cookie. The two cookies are still
//     unforgeable across realms because:
//       (a) the payload includes a `realm: 'admin'` claim that the verify
//           path checks — a customer cookie has no such claim (or has
//           `realm: 'customer'`), so a customer cookie presented to
//           `getCurrentAdminUser()` is rejected;
//       (b) the cookie NAMES are different, so a customer cookie cannot
//           even be READ by the admin verify path (it reads
//           `anima_admin_session` only).
//   - Every request RE-FETCHES the AdminUser row from the DB to verify
//     `isActive`, `systemRole`, `sessionVersion`, and `mustChangePassword`.
//     NONE of these are trusted from the cookie.
//   - `sessionVersion` is the session-invalidation mechanism. On password
//     change/reset, the DB's sessionVersion is bumped — all cookies issued
//     before the bump are immediately invalid (the comparison fails).
//   - `mustChangePassword = true` blocks ALL admin routes except
//     /admin/change-password and /admin/logout. The session IS issued (so
//     the admin can reach the change-password page), but every other admin
//     route rejects them with 403 MUST_CHANGE_PASSWORD.
//   - `isActive = false` blocks login AND invalidates existing sessions
//     (re-fetched on every request).
// ============================================================================

import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  SYSTEM_ROLE_DEVELOPER,
  isValidPermissionKey,
  type PermissionKey,
  type SystemRole,
} from '@/lib/admin-permissions'

// Re-use AuthError + handleAuthError from the customer auth module — same
// structured { status, code } pattern, same production-sanitized logging.
// The error types are realm-agnostic; the AUTHORIZATION decisions are made
// by the helpers below, not by AuthError itself.
export {
  AuthError,
  handleAuthError,
  logAuthError,
} from '@/lib/auth'

// ============================================================================
// Constants
// ============================================================================

const ADMIN_SESSION_COOKIE = 'anima_admin_session'
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8 // 8 hours — shorter than customer (7d) because admin actions are higher-privilege.

// Payload shape encoded into the HMAC admin session cookie.
interface AdminSessionPayload {
  adminUserId: string
  username: string
  systemRole: SystemRole
  sessionVersion: number
  // Realm marker — defense-in-depth so a customer cookie (which has no
  // `realm` claim) cannot be replayed as an admin cookie even if someone
  // accidentally reuses the cookie name. The verify path rejects any
  // payload whose `realm !== 'admin'`.
  realm: 'admin'
  exp: number
}

// Same lazy-secret pattern as src/lib/auth.ts — production throws on first
// use if AUTH_SECRET is missing; dev falls back to a deterministic secret.
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

// ============================================================================
// HMAC sign / verify — same crypto pattern as customer session, but with
// the `realm: 'admin'` marker in the payload.
// ============================================================================

async function sign(payload: AdminSessionPayload): Promise<string> {
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

async function verify(token: string): Promise<AdminSessionPayload | null> {
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
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as AdminSessionPayload
    if (payload.exp && Date.now() > payload.exp) return null
    // Realm marker — reject any token that isn't explicitly an admin token.
    // This is the cross-realm replay defense: even if a customer cookie's
    // body is fed to this verify path, the missing/wrong `realm` claim
    // causes rejection.
    if (payload.realm !== 'admin') return null
    return payload
  } catch {
    return null
  }
}

// ============================================================================
// Password hashing — bcrypt cost 10, same as customer auth.
// Plaintext is NEVER stored, NEVER logged, NEVER returned by any API.
// ============================================================================

export async function hashAdminPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function compareAdminPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ============================================================================
// Admin session issuance / destruction.
// ============================================================================

export interface AdminSessionInput {
  adminUserId: string
  username: string
  systemRole: SystemRole
  sessionVersion: number
}

export async function createAdminSession(input: AdminSessionInput): Promise<void> {
  const payload: AdminSessionPayload = {
    adminUserId: input.adminUserId,
    username: input.username,
    systemRole: input.systemRole,
    sessionVersion: input.sessionVersion,
    realm: 'admin',
    exp: Date.now() + ADMIN_SESSION_MAX_AGE * 1000,
  }
  const token = await sign(payload)
  const cookieStore = await cookies()
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: '/',
  })
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(ADMIN_SESSION_COOKIE)
}

// ============================================================================
// Admin session verification — re-fetches the AdminUser row from the DB on
// every call. NEVER trusts cookie claims for authorization.
//
// Returns the live AdminUser row (with permissions) or null.
// ============================================================================

export interface AdminUserWithPermissions {
  id: string
  username: string
  displayName: string
  systemRole: SystemRole
  isActive: boolean
  mustChangePassword: boolean
  sessionVersion: number
  permissions: string[]
}

export async function getCurrentAdminUser(): Promise<AdminUserWithPermissions | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!token) return null
  const payload = await verify(token)
  if (!payload) return null

  // Re-fetch the authoritative AdminUser row from the DB. The cookie only
  // carries identity + sessionVersion — we NEVER trust cookie claims for
  // isActive / systemRole / permissions.
  const admin = await db.adminUser.findUnique({
    where: { id: payload.adminUserId },
    select: {
      id: true,
      username: true,
      displayName: true,
      systemRole: true,
      isActive: true,
      mustChangePassword: true,
      sessionVersion: true,
      permissions: { select: { permissionKey: true } },
    },
  })
  if (!admin) return null

  // sessionVersion check — if the cookie's version doesn't match the DB's,
  // the session was issued before a password reset/change. Treat as
  // unauthenticated (the caller will redirect to /admin/login).
  if (payload.sessionVersion !== admin.sessionVersion) return null

  // isActive check — even if the cookie is fresh, a deactivated admin
  // cannot use the panel. The session is treated as invalid.
  if (!admin.isActive) return null

  return {
    id: admin.id,
    username: admin.username,
    displayName: admin.displayName,
    systemRole: admin.systemRole as SystemRole,
    isActive: admin.isActive,
    mustChangePassword: admin.mustChangePassword,
    sessionVersion: admin.sessionVersion,
    permissions: admin.permissions.map((p) => p.permissionKey),
  }
}

// ============================================================================
// Authorization helpers.
//
// These throw AuthError('UNAUTHENTICATED') or AuthError('FORBIDDEN') — the
// same structured-error pattern as customer auth. Route handlers use
// `handleAuthError(e)` to convert to a NextResponse.
// ============================================================================

// Imported here so callers can do `import { requireAdminSession } from '@/lib/admin-auth'`
// without a second import for AuthError.
import { AuthError } from '@/lib/auth'

/**
 * Require an authenticated admin session. Throws AuthError('UNAUTHENTICATED')
 * if no valid admin session is present. Returns the live AdminUser row.
 *
 * NOTE: This does NOT check `mustChangePassword`. Routes that are blocked
 * during the must-change-password state should use `requireAdminSessionActive`
 * instead. The change-password route itself uses `requireAdminSession` so
 * the admin can reach it.
 */
export async function requireAdminSession(): Promise<AdminUserWithPermissions> {
  const admin = await getCurrentAdminUser()
  if (!admin) {
    throw new AuthError('UNAUTHENTICATED')
  }
  return admin
}

/**
 * Require an authenticated admin session AND `mustChangePassword === false`.
 * Use this for ALL admin routes except /admin/change-password and
 * /admin/logout. Throws AuthError('FORBIDDEN') with code 'MUST_CHANGE_PASSWORD'
 * if the admin must change their password.
 *
 * (AuthError only carries 'UNAUTHENTICATED' | 'FORBIDDEN' codes — we encode
 * the MUST_CHANGE_PASSWORD reason into the response body via the route
 * handler, not via the AuthError code. The route handler can detect this
 * case by checking `admin.mustChangePassword` directly after calling
 * `requireAdminSession`. This helper is a convenience that throws FORBIDDEN
 * for the must-change case.)
 */
export async function requireAdminSessionActive(): Promise<AdminUserWithPermissions> {
  const admin = await requireAdminSession()
  if (admin.mustChangePassword) {
    throw new AuthError('FORBIDDEN')
  }
  return admin
}

/**
 * Require an authenticated admin session whose systemRole === 'DEVELOPER'.
 * Use this for developer-only routes (manage AdminUser, manage permissions,
 * reset admin passwords). Throws AuthError('FORBIDDEN') for non-developers.
 */
export async function requireDeveloper(): Promise<AdminUserWithPermissions> {
  const admin = await requireAdminSessionActive()
  if (admin.systemRole !== SYSTEM_ROLE_DEVELOPER) {
    throw new AuthError('FORBIDDEN')
  }
  return admin
}

/**
 * Require an authenticated admin session that has the given permission key.
 * DEVELOPER bypasses this check (returns ok for any key). ADMIN must have
 * the key in their AdminPermission set. Throws AuthError('FORBIDDEN') if
 * the admin lacks the permission.
 *
 * The `key` argument is validated at compile time (it must be a literal
 * from PERMISSION_KEYS) and at runtime (isValidPermissionKey) so a typo
 * can't silently allow access.
 */
export async function requirePermission(
  key: PermissionKey
): Promise<AdminUserWithPermissions> {
  // Runtime validation — defense-in-depth against a typo in a future call site.
  if (!isValidPermissionKey(key)) {
    // This is a programming error, not an auth error. Throw a plain Error
    // so it surfaces as a 500 (and is caught by tests) rather than a 403
    // that might mask the bug.
    throw new Error(`Unknown permission key: ${String(key)}`)
  }
  const admin = await requireAdminSessionActive()
  // DEVELOPER bypasses all permission checks.
  if (admin.systemRole === SYSTEM_ROLE_DEVELOPER) return admin
  // ADMIN must have the key in their permission set.
  if (!admin.permissions.includes(key)) {
    throw new AuthError('FORBIDDEN')
  }
  return admin
}

/**
 * Check (without throwing) whether the current admin has the given
 * permission. Use this for sidebar rendering where a 403 throw would
 * break the page. Returns true for DEVELOPER; for ADMIN, returns true
 * iff the key is in their permission set. Returns false if no admin
 * session is active.
 */
export async function hasPermission(
  key: PermissionKey
): Promise<boolean> {
  const admin = await getCurrentAdminUser()
  if (!admin) return false
  if (admin.mustChangePassword) return false
  if (admin.systemRole === SYSTEM_ROLE_DEVELOPER) return true
  return admin.permissions.includes(key)
}

// Re-export commonly-used bits so callers can import everything from one
// module.
export { SYSTEM_ROLE_DEVELOPER, SYSTEM_ROLE_ADMIN } from '@/lib/admin-permissions'
export type { PermissionKey, SystemRole } from '@/lib/admin-permissions'

// Suppress unused-import lint for NextResponse (kept for future
// convenience helpers that may return NextResponse directly).
export type { NextResponse }
