import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  requireDeveloper,
  hashAdminPassword,
  handleAuthError,
  logAuthError,
} from '@/lib/admin-auth'
import { SYSTEM_ROLE_DEVELOPER } from '@/lib/admin-permissions'

// ============================================================================
// POST /api/admin/users/[id]/reset-password — Developer resets an admin's
// password (DEVELOPER only).
//
// BODY:
//   { newPassword }
//
// SECURITY:
//   - requireDeveloper — only DEVELOPER can reset passwords.
//   - If target is a DEVELOPER: REJECT. Developer passwords are managed by
//     the developer themselves via /admin/change-password. The bootstrap
//     developer's password can be re-set via env vars + re-seed (idempotent
//     seed will NOT overwrite — operator must use Prisma Studio / psql to
//     force-reset if the bootstrap developer forgets their password).
//   - newPassword must be >= 8 chars.
//   - On success:
//       * passwordHash is replaced with the new bcrypt hash.
//       * mustChangePassword is set to TRUE (the admin must change it
//         again on next login — the Developer's temp password should be
//         treated as compromised the moment it's communicated out-of-band).
//       * sessionVersion is incremented by 1 — ALL existing sessions for
//         this admin are immediately invalidated. The admin must log in
//         again with the new temp password.
//   - The new temp password is NOT returned in the response. The Developer
//     already knows it (they provided it). Response is { ok: true }.
// ============================================================================

const MIN_PASSWORD_LENGTH = 8

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    await requireDeveloper()
    const { id } = await ctx.params

    const target = await db.adminUser.findUnique({
      where: { id },
      select: { systemRole: true, sessionVersion: true },
    })
    if (!target) {
      return NextResponse.json({ error: 'Admin tidak ditemukan' }, { status: 404 })
    }

    // DEVELOPER PROTECTION: no API can reset a Developer's password.
    if (target.systemRole === SYSTEM_ROLE_DEVELOPER) {
      return NextResponse.json(
        { error: 'Password Developer tidak dapat direset via API' },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => null)
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

    if (!newPassword) {
      return NextResponse.json({ error: 'Password baru wajib diisi' }, { status: 400 })
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password baru minimal ${MIN_PASSWORD_LENGTH} karakter` },
        { status: 400 }
      )
    }

    const newHash = await hashAdminPassword(newPassword)
    const newSessionVersion = target.sessionVersion + 1

    await db.adminUser.update({
      where: { id },
      data: {
        passwordHash: newHash,
        mustChangePassword: true,
        sessionVersion: newSessionVersion,
      },
    })

    // NOTE: We do NOT issue a session cookie here. The admin's existing
    // sessions (if any) are invalidated by the sessionVersion bump. The
    // admin must log in again at /admin/login with the new temp password.

    return NextResponse.json({ ok: true })
  } catch (e) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    logAuthError('Admin user reset-password error', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
