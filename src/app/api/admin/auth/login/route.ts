import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  compareAdminPassword,
  createAdminSession,
  logAuthError,
} from '@/lib/admin-auth'

// ============================================================================
// POST /api/admin/auth/login — Internal admin realm login.
//
// COMPLETELY SEPARATE from customer /api/auth/login:
//   - Username + password (NOT email + password)
//   - No OTP, no Google OAuth, no email verification, no forgot-password
//   - Sets `anima_admin_session` cookie (NOT `anima_session`)
//   - Authenticates against `AdminUser` table (NOT `User`)
//
// ANTI-ENUMERATION CONTRACT:
//   Every failure case returns the SAME generic message
//   "Username atau password salah" with HTTP 401. An attacker cannot
//   distinguish "username doesn't exist" from "wrong password" from
//   "account disabled". The only variation is the server-side log label
//   (which never reaches the client).
//
// SECURITY:
//   - Username is normalized to lower-case before lookup (matches the
//     case-insensitive uniqueness contract in prisma/schema.prisma).
//   - bcrypt.compare runs in constant time relative to the stored hash.
//   - On success, lastLoginAt is updated and a fresh admin session cookie
//     is issued carrying (adminUserId, username, systemRole, sessionVersion).
//   - The cookie does NOT carry permissions or mustChangePassword — those
//     are re-fetched from the DB on every request by getCurrentAdminUser.
//
// RESPONSE (200):
//   { user: { id, username, displayName, systemRole, mustChangePassword } }
//   The client uses `mustChangePassword` to decide the post-login redirect:
//     - true  → /admin/change-password (first-login forced change)
//     - false → /admin (or ?next= if a safe internal path was provided)
// ============================================================================

const GENERIC_ERROR = 'Username atau password salah'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const username = typeof body?.username === 'string' ? body.username.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username dan password wajib diisi' },
        { status: 400 }
      )
    }

    // Case-insensitive username lookup — schema stores lower-case.
    const admin = await db.adminUser.findUnique({
      where: { username: username.toLowerCase() },
      select: {
        id: true,
        username: true,
        displayName: true,
        systemRole: true,
        isActive: true,
        mustChangePassword: true,
        sessionVersion: true,
        passwordHash: true,
      },
    })

    if (!admin) {
      // Same generic message as wrong-password — no enumeration leak.
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
    }

    const valid = await compareAdminPassword(password, admin.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
    }

    // Inactive admin cannot log in. Same generic message — no leak.
    if (!admin.isActive) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
    }

    // Success — issue the admin session cookie.
    await createAdminSession({
      adminUserId: admin.id,
      username: admin.username,
      systemRole: admin.systemRole as 'DEVELOPER' | 'ADMIN',
      sessionVersion: admin.sessionVersion,
    })

    // Update lastLoginAt (best-effort, non-blocking for the response).
    db.adminUser
      .update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
      })
      .catch(() => {
        /* lastLoginAt is informational only — never fail login over it. */
      })

    return NextResponse.json({
      user: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        systemRole: admin.systemRole,
        mustChangePassword: admin.mustChangePassword,
      },
    })
  } catch (e) {
    logAuthError('Admin login error', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
