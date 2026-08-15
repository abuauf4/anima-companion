import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  compareAdminPassword,
  createAdminSession,
  hashAdminPassword,
  requireAdminSession,
  handleAuthError,
  logAuthError,
} from '@/lib/admin-auth'

// ============================================================================
// POST /api/admin/auth/change-password — Own-password change.
//
// Used by BOTH:
//   - First-login forced change (mustChangePassword === true → the admin
//     was created by the Developer with a temp password and MUST set a
//     new one before reaching any panel route).
//   - Voluntary own-password change (mustChangePassword === false → the
//     admin is already in the panel and wants to rotate their password).
//
// This is the ONE admin auth route that works during the mustChangePassword
// state. It uses `requireAdminSession` (NOT `requireAdminSessionActive`)
// so the admin can reach it. Every other admin route uses
// `requireAdminSessionActive` which throws FORBIDDEN when
// mustChangePassword === true.
//
// BODY:
//   { currentPassword, newPassword, confirmPassword }
//
// SECURITY:
//   - currentPassword is verified against the stored bcrypt hash. An
//     attacker who steals the session cookie cannot change the password
//     without also knowing the current password.
//   - newPassword must differ from currentPassword (no-op change rejected).
//   - newPassword must be >= 8 chars (matches customer auth policy).
//   - On success:
//       * passwordHash is replaced with the new bcrypt hash.
//       * mustChangePassword is set to false (the forced-change gate lifts).
//       * sessionVersion is incremented by 1 — this INVALIDATES every
//         other session cookie issued to this admin (the old cookie's
//         sessionVersion no longer matches the DB). The current session
//         is re-issued with the new sessionVersion so the admin stays
//         logged in on THIS device.
//   - The password hash is NEVER returned. The response is { ok: true }.
// ============================================================================

const MIN_PASSWORD_LENGTH = 8

export async function POST(req: NextRequest) {
  try {
    // requireAdminSession (NOT requireAdminSessionActive) — this route
    // must work during the mustChangePassword state.
    const admin = await requireAdminSession()

    const body = await req.json().catch(() => null)
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''
    const confirmPassword = typeof body?.confirmPassword === 'string' ? body.confirmPassword : ''

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'Semua field wajib diisi' },
        { status: 400 }
      )
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'Password baru dan konfirmasi tidak cocok' },
        { status: 400 }
      )
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password baru minimal ${MIN_PASSWORD_LENGTH} karakter` },
        { status: 400 }
      )
    }

    // Verify current password.
    const adminRow = await db.adminUser.findUnique({
      where: { id: admin.id },
      select: { passwordHash: true, sessionVersion: true },
    })
    if (!adminRow) {
      // Should not happen — requireAdminSession just verified the row.
      return NextResponse.json({ error: 'Akun tidak ditemukan' }, { status: 404 })
    }

    const valid = await compareAdminPassword(currentPassword, adminRow.passwordHash)
    if (!valid) {
      return NextResponse.json(
        { error: 'Password saat ini salah' },
        { status: 401 }
      )
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: 'Password baru tidak boleh sama dengan password lama' },
        { status: 400 }
      )
    }

    // All checks passed — replace the password and bump sessionVersion.
    const newHash = await hashAdminPassword(newPassword)
    const newSessionVersion = adminRow.sessionVersion + 1

    await db.adminUser.update({
      where: { id: admin.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        sessionVersion: newSessionVersion,
      },
    })

    // Re-issue the admin session cookie with the new sessionVersion so
    // the admin stays logged in on THIS device. All OTHER sessions (other
    // devices, other browsers) are invalidated because their cookies still
    // carry the old sessionVersion.
    await createAdminSession({
      adminUserId: admin.id,
      username: admin.username,
      systemRole: admin.systemRole,
      sessionVersion: newSessionVersion,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    logAuthError('Admin change-password error', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
