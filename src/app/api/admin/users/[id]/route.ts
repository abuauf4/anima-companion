import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  requireDeveloper,
  handleAuthError,
  logAuthError,
} from '@/lib/admin-auth'
import { SYSTEM_ROLE_DEVELOPER } from '@/lib/admin-permissions'

// ============================================================================
// GET /api/admin/users/[id] — Get a single admin's detail (DEVELOPER only).
//
// Returns the admin's identity + permissions. NO passwordHash.
// ============================================================================

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    await requireDeveloper()
    const { id } = await ctx.params

    const admin = await db.adminUser.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        displayName: true,
        systemRole: true,
        isActive: true,
        mustChangePassword: true,
        sessionVersion: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        createdByAdminId: true,
        permissions: { select: { permissionKey: true } },
      },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({
      admin: {
        ...admin,
        permissions: admin.permissions.map((p) => p.permissionKey),
      },
    })
  } catch (e) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    logAuthError('Admin user detail error', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

// ============================================================================
// PATCH /api/admin/users/[id] — Update admin profile (DEVELOPER only).
//
// BODY (all optional, partial update):
//   { displayName?, isActive? }
//
// SECURITY:
//   - systemRole is NOT mutable via this route (no endpoint to change role).
//   - username is NOT mutable (prevents identity confusion).
//   - passwordHash is NOT mutable here (use /reset-password).
//   - mustChangePassword is NOT mutable here (use /reset-password).
//   - sessionVersion is NOT mutable here.
//   - If target is a DEVELOPER: REJECT. Developer accounts cannot be
//     modified by anyone via the API (only the developer themselves can
//     change their own password via /admin/change-password). This protects
//     the bootstrap developer from being disabled or renamed by a future
//     second developer who might go rogue.
//   - The body CANNOT escalate: unknown fields are ignored; isActive is
//     a boolean or rejected.
//
// Response (200):
//   { admin: { id, username, displayName, systemRole, isActive,
//              mustChangePassword, updatedAt } }
// ============================================================================

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    await requireDeveloper()
    const { id } = await ctx.params

    // Fetch the target admin first — need to check systemRole.
    const target = await db.adminUser.findUnique({
      where: { id },
      select: { systemRole: true, username: true },
    })
    if (!target) {
      return NextResponse.json({ error: 'Admin tidak ditemukan' }, { status: 404 })
    }

    // DEVELOPER PROTECTION: no API can modify a Developer account.
    if (target.systemRole === SYSTEM_ROLE_DEVELOPER) {
      return NextResponse.json(
        { error: 'Akun Developer tidak dapat dimodifikasi via API' },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => null)
    const data: { displayName?: string; isActive?: boolean } = {}

    if (typeof body?.displayName === 'string') {
      const trimmed = body.displayName.trim()
      if (!trimmed) {
        return NextResponse.json({ error: 'Nama tidak boleh kosong' }, { status: 400 })
      }
      data.displayName = trimmed
    }

    if (typeof body?.isActive === 'boolean') {
      data.isActive = body.isActive
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada field yang akan diupdate' },
        { status: 400 }
      )
    }

    const updated = await db.adminUser.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        displayName: true,
        systemRole: true,
        isActive: true,
        mustChangePassword: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ admin: updated })
  } catch (e) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    logAuthError('Admin user update error', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
