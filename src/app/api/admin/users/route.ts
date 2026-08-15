import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  requireDeveloper,
  hashAdminPassword,
  handleAuthError,
  logAuthError,
} from '@/lib/admin-auth'
import {
  PERMISSION_KEY_SET,
  SYSTEM_ROLE_DEVELOPER,
  SYSTEM_ROLE_ADMIN,
} from '@/lib/admin-permissions'

// ============================================================================
// GET /api/admin/users — List all admin users (DEVELOPER only).
//
// Returns every AdminUser row with their permissions. NO passwordHash is
// ever returned (not even to the Developer — plaintext is never retrievable).
//
// Response (200):
//   { admins: [{ id, username, displayName, systemRole, isActive,
//                mustChangePassword, sessionVersion, lastLoginAt,
//                createdAt, createdByAdminId, permissions: string[] }] }
// ============================================================================

export async function GET() {
  try {
    await requireDeveloper()

    const rows = await db.adminUser.findMany({
      orderBy: [{ systemRole: 'asc' }, { createdAt: 'asc' }],
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
        createdByAdminId: true,
        permissions: { select: { permissionKey: true } },
      },
    })

    const admins = rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.displayName,
      systemRole: r.systemRole,
      isActive: r.isActive,
      mustChangePassword: r.mustChangePassword,
      sessionVersion: r.sessionVersion,
      lastLoginAt: r.lastLoginAt,
      createdAt: r.createdAt,
      createdByAdminId: r.createdByAdminId,
      permissions: r.permissions.map((p) => p.permissionKey),
    }))

    return NextResponse.json({ admins })
  } catch (e) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    logAuthError('Admin users list error', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

// ============================================================================
// POST /api/admin/users — Create a new admin (DEVELOPER only).
//
// BODY:
//   { username, displayName, password, permissions?: string[] }
//
// SECURITY:
//   - systemRole is HARDCODED to 'ADMIN' — the request payload CANNOT
//     create a DEVELOPER. Only the env-var-driven bootstrap seed can
//     create a DEVELOPER. (Any systemRole field in the payload is
//     ignored.)
//   - Username is lower-cased and must be unique.
//   - Password is hashed with bcrypt (cost 10). Plaintext is NEVER stored.
//   - mustChangePassword is hardcoded to true — the new admin MUST change
//     their password on first login.
//   - createdByAdminId is set to the current developer's id.
//   - permissions (optional) must be a subset of PERMISSION_KEYS. Unknown
//     keys are rejected with 400 (not silently dropped).
//   - The response includes the temp password ONLY if the Developer
//     provided it — the server does NOT generate a password. The Developer
//     is responsible for securely communicating the temp password to the
//     new admin out-of-band.
//
// Response (201):
//   { admin: { id, username, displayName, systemRole, isActive,
//              mustChangePassword, createdAt, permissions: string[] } }
// ============================================================================

const MIN_PASSWORD_LENGTH = 8
const MIN_USERNAME_LENGTH = 3

export async function POST(req: NextRequest) {
  try {
    const developer = await requireDeveloper()

    const body = await req.json().catch(() => null)
    const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : ''
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const rawPermissions = Array.isArray(body?.permissions) ? body.permissions : []

    if (!username || !displayName || !password) {
      return NextResponse.json(
        { error: 'Username, nama, dan password wajib diisi' },
        { status: 400 }
      )
    }

    if (username.length < MIN_USERNAME_LENGTH) {
      return NextResponse.json(
        { error: `Username minimal ${MIN_USERNAME_LENGTH} karakter` },
        { status: 400 }
      )
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password minimal ${MIN_PASSWORD_LENGTH} karakter` },
        { status: 400 }
      )
    }

    // Validate all permission keys — reject unknown keys (no silent drop).
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

    // Check username uniqueness (Prisma will also enforce via @unique, but
    // we want a friendly error message, not a raw P2002).
    const existing = await db.adminUser.findUnique({ where: { username } })
    if (existing) {
      return NextResponse.json(
        { error: 'Username sudah digunakan' },
        { status: 409 }
      )
    }

    const passwordHash = await hashAdminPassword(password)

    // Create the admin + permissions in a single transaction so a partial
    // failure (e.g. one bad permission key slipping through) doesn't leave
    // an orphan AdminUser row.
    const created = await db.$transaction(async (tx) => {
      const admin = await tx.adminUser.create({
        data: {
          username,
          passwordHash,
          displayName,
          systemRole: SYSTEM_ROLE_ADMIN, // HARDCODED — payload cannot create DEVELOPER
          isActive: true,
          mustChangePassword: true, // forced first-login change
          sessionVersion: 0,
          createdByAdminId: developer.id,
        },
      })
      if (permissions.length > 0) {
        await tx.adminPermission.createMany({
          data: permissions.map((permissionKey) => ({
            adminUserId: admin.id,
            permissionKey,
          })),
        })
      }
      return admin
    })

    return NextResponse.json(
      {
        admin: {
          id: created.id,
          username: created.username,
          displayName: created.displayName,
          systemRole: created.systemRole,
          isActive: created.isActive,
          mustChangePassword: created.mustChangePassword,
          createdAt: created.createdAt,
          permissions,
        },
      },
      { status: 201 }
    )
  } catch (e) {
    const authRes = handleAuthError(e)
    if (authRes) return authRes
    logAuthError('Admin users create error', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
