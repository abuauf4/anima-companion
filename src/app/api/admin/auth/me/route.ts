import { NextResponse } from 'next/server'
import { getCurrentAdminUser, handleAuthError } from '@/lib/admin-auth'

// ============================================================================
// GET /api/admin/auth/me — Current admin session check.
//
// Returns the authenticated admin's identity (NO password hash, NO
// sessionVersion, NO session internals). Used by:
//   - /admin/login page (redirect to /admin if already authenticated)
//   - /admin/change-password page (redirect to /admin/login if no session)
//   - /admin panel shell (permission-aware sidebar in Stage 3)
//
// RESPONSE (200):
//   { admin: { id, username, displayName, systemRole, mustChangePassword,
//              permissions: string[] } }
// RESPONSE (401):
//   { error: 'Tidak diizinkan', code: 'UNAUTHENTICATED' }
//
// The `permissions` array is the FULL set of permission keys granted to
// this admin. For DEVELOPER, it's the full PERMISSION_KEYS list (bypass).
// For ADMIN, it's the explicit AdminPermission rows. The client uses this
// to render the permission-aware sidebar — but the SERVER re-checks every
// permission on every mutation, so a tampered client cannot escalate.
// ============================================================================

export async function GET() {
  try {
    const admin = await getCurrentAdminUser()
    if (!admin) {
      return NextResponse.json(
        { error: 'Tidak diizinkan', code: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }
    return NextResponse.json({
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        systemRole: admin.systemRole,
        mustChangePassword: admin.mustChangePassword,
        permissions: admin.permissions,
      },
    })
  } catch (e) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
