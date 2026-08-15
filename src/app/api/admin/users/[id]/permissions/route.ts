import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  requireDeveloper,
  handleAuthError,
  logAuthError,
} from '@/lib/admin-auth'
import {
  PERMISSION_KEY_SET,
  SYSTEM_ROLE_DEVELOPER,
} from '@/lib/admin-permissions'

// ============================================================================
// PUT /api/admin/users/[id]/permissions — Replace an admin's permission set
// (DEVELOPER only).
//
// BODY:
//   { permissions: string[] }
//
// SECURITY:
//   - requireDeveloper — only DEVELOPER can assign/revoke permissions.
//   - If target is a DEVELOPER: REJECT. Developer bypasses all permission
//     checks, so assigning permissions to a Developer is meaningless AND
//     could be confusing (it would imply the Developer's access is
//     scoped, which it is not).
//   - Every key in `permissions` MUST be a known PERMISSION_KEY. Unknown
//     keys are rejected with 400 (not silently dropped) — this catches
//     typos and prevents a future key-removal from silently widening
//     access.
//   - The operation is a FULL REPLACE (not union, not diff). The admin's
//     permission set after the call is exactly the body's `permissions`
//     array (de-duplicated). This is idempotent and easy to reason about.
//   - The body CANNOT grant a "DEVELOPER bypass" permission — no such
//     key exists in PERMISSION_KEYS.
//   - The body CANNOT escalate the caller — requireDeveloper already
//     verified the caller is a Developer; the body is irrelevant to the
//     caller's own privileges.
//
// Response (200):
//   { permissions: string[] }  (the new full permission set, sorted)
// ============================================================================

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    await requireDeveloper()
    const { id } = await ctx.params

    const target = await db.adminUser.findUnique({
      where: { id },
      select: { systemRole: true },
    })
    if (!target) {
      return NextResponse.json({ error: 'Admin tidak ditemukan' }, { status: 404 })
    }

    // DEVELOPER PROTECTION: no API can modify a Developer's permissions.
    if (target.systemRole === SYSTEM_ROLE_DEVELOPER) {
      return NextResponse.json(
        { error: 'Permission Developer tidak dapat diubah via API' },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => null)
    const rawPermissions = Array.isArray(body?.permissions) ? body.permissions : []

    // Validate ALL keys — reject unknown (no silent drop).
    const permissions: string[] = []
    for (const key of rawPermissions) {
      if (typeof key !== 'string' || !PERMISSION_KEY_SET.has(key)) {
        return NextResponse.json(
          { error: `Permission tidak dikenal: ${String(key)}` },
          { status: 400 }
        )
      }
      if (!permissions.includes(key)) permissions.push(key)
    }

    // Full replace inside a transaction: delete all existing, insert new set.
    // This is idempotent — calling with the same array twice produces the
    // same end state.
    await db.$transaction(async (tx) => {
      await tx.adminPermission.deleteMany({ where: { adminUserId: id } })
      if (permissions.length > 0) {
        await tx.adminPermission.createMany({
          data: permissions.map((permissionKey) => ({
            adminUserId: id,
            permissionKey,
          })),
        })
      }
    })

    return NextResponse.json({ permissions: permissions.sort() })
  } catch (e) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    logAuthError('Admin user permissions update error', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
