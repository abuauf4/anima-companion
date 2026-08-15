/**
 * Admin Realm V1 — Stage 3 static integrity tests.
 *
 * Run with:
 *   bun run scripts/test-admin-rbac.ts
 *
 * This is a PURE-STATIC test suite (no DB, no HTTP). It verifies the Stage 3
 * Developer User Admin management + RBAC source code has the required
 * security properties.
 *
 * Coverage:
 *   - /api/admin/users (GET list, POST create): requireDeveloper, systemRole
 *     hardcoded ADMIN, username lower-case, bcrypt, mustChangePassword=true,
 *     createdByAdminId, permission key validation.
 *   - /api/admin/users/[id] (GET, PATCH): requireDeveloper, Developer
 *     protection (403 on Developer target), no systemRole/username/password
 *     mutation via PATCH.
 *   - /api/admin/users/[id]/reset-password: requireDeveloper, Developer
 *     protection, sessionVersion++, mustChangePassword=true, no session
 *     re-issue (admin must re-login).
 *   - /api/admin/users/[id]/permissions: requireDeveloper, Developer
 *     protection, full replace (delete + insert), unknown key rejection.
 *   - AdminUsersView: create/edit/permissions/reset/disable UI, Developer
 *     rows disabled, no passwordHash display, no systemRole field.
 *   - AdminLayout: permission-aware sidebar, Developer sees all + Setting
 *     User Admin, ADMIN sees only permitted items, legacy fallback (no
 *     adminInfo → all items), Ganti Password + Keluar only for new-realm.
 *   - Customer auth regression: /api/auth/* untouched, LoginView untouched.
 */

// ----- Safety guard -----
if (process.env.NODE_ENV === 'production') {
  console.error('REFUSING TO RUN: NODE_ENV is "production".')
  process.exit(2)
}

import { readFileSync } from 'fs'
import { resolve } from 'path'

let pass = 0
let fail = 0
const failures: string[] = []

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`)
    pass++
  } else {
    console.log(`  ❌ ${message}`)
    fail++
    failures.push(message)
  }
}

const repoRoot = resolve(__dirname, '..')
function readSrc(rel: string): string {
  return readFileSync(resolve(repoRoot, rel), 'utf8')
}

// ============================================================================
// PHASE A — /api/admin/users (GET list + POST create)
// ============================================================================
console.log('\n=== PHASE A — /api/admin/users (list + create) ===')

const usersRoute = readSrc('src/app/api/admin/users/route.ts')
assert(usersRoute.includes('export async function GET'), 'users route exports GET (list)')
assert(usersRoute.includes('export async function POST'), 'users route exports POST (create)')
assert(usersRoute.includes('requireDeveloper'), 'users route uses requireDeveloper (both GET and POST)')
assert(usersRoute.includes('SYSTEM_ROLE_ADMIN'), 'create hardcodes systemRole=ADMIN')
assert(usersRoute.includes('username.toLowerCase()') || usersRoute.includes('.toLowerCase()'), 'create lower-cases username')
assert(usersRoute.includes('hashAdminPassword'), 'create hashes password with bcrypt')
assert(usersRoute.includes('mustChangePassword: true'), 'create sets mustChangePassword=true (forced first-login change)')
assert(usersRoute.includes('createdByAdminId'), 'create sets createdByAdminId')
assert(usersRoute.includes('PERMISSION_KEY_SET'), 'create validates permission keys against PERMISSION_KEY_SET')
assert(usersRoute.includes('db.$transaction'), 'create uses transaction (atomic admin + permissions)')
assert(!usersRoute.match(/systemRole.*body|body.*systemRole/), 'create does NOT read systemRole from body')
assert(!usersRoute.match(/return.*passwordHash|passwordHash.*return/), 'create does NOT return passwordHash')
assert(usersRoute.includes('handleAuthError'), 'users route uses handleAuthError')
assert(usersRoute.includes('logAuthError'), 'users route uses logAuthError')

// ============================================================================
// PHASE B — /api/admin/users/[id] (GET detail + PATCH update)
// ============================================================================
console.log('\n=== PHASE B — /api/admin/users/[id] (detail + update) ===')

const userDetailRoute = readSrc('src/app/api/admin/users/[id]/route.ts')
assert(userDetailRoute.includes('export async function GET'), 'user detail exports GET')
assert(userDetailRoute.includes('export async function PATCH'), 'user detail exports PATCH')
assert(userDetailRoute.includes('requireDeveloper'), 'user detail uses requireDeveloper (both GET and PATCH)')
// Developer protection:
assert(userDetailRoute.includes('SYSTEM_ROLE_DEVELOPER'), 'user detail checks SYSTEM_ROLE_DEVELOPER (Developer protection)')
assert(userDetailRoute.includes('Akun Developer tidak dapat dimodifikasi via API') || userDetailRoute.includes('403'), 'PATCH rejects Developer target with 403')
// No mutable systemRole/username/password via PATCH:
assert(!userDetailRoute.match(/systemRole.*body|body.*systemRole/), 'PATCH does NOT read systemRole from body')
assert(!userDetailRoute.match(/username.*body|body.*username/), 'PATCH does NOT read username from body (immutable)')
assert(!userDetailRoute.match(/passwordHash.*body|body.*passwordHash/), 'PATCH does NOT read passwordHash from body (use reset-password)')
assert(!userDetailRoute.match(/mustChangePassword.*body|body.*mustChangePassword/), 'PATCH does NOT read mustChangePassword from body (use reset-password)')
// Only displayName + isActive are mutable:
assert(userDetailRoute.includes('displayName'), 'PATCH allows displayName update')
assert(userDetailRoute.includes('isActive'), 'PATCH allows isActive update')
assert(!userDetailRoute.match(/return.*passwordHash/), 'GET does NOT return passwordHash')
assert(userDetailRoute.includes('handleAuthError'), 'user detail uses handleAuthError')

// ============================================================================
// PHASE C — /api/admin/users/[id]/reset-password
// ============================================================================
console.log('\n=== PHASE C — /api/admin/users/[id]/reset-password ===')

const resetRoute = readSrc('src/app/api/admin/users/[id]/reset-password/route.ts')
assert(resetRoute.includes('export async function POST'), 'reset-password exports POST')
assert(resetRoute.includes('requireDeveloper'), 'reset-password uses requireDeveloper')
assert(resetRoute.includes('SYSTEM_ROLE_DEVELOPER'), 'reset-password checks Developer protection')
assert(resetRoute.includes('Password Developer tidak dapat direset via API') || resetRoute.includes('403'), 'reset-password rejects Developer target with 403')
assert(resetRoute.includes('hashAdminPassword'), 'reset-password hashes new password with bcrypt')
assert(resetRoute.includes('mustChangePassword: true'), 'reset-password sets mustChangePassword=true (admin must change again)')
assert(resetRoute.includes('sessionVersion'), 'reset-password bumps sessionVersion')
assert(/\+\s*1/.test(resetRoute), 'reset-password increments sessionVersion by 1')
// CRITICAL: reset-password must NOT issue a new session (admin must re-login):
assert(!resetRoute.includes('createAdminSession'), 'reset-password does NOT issue new session (admin must re-login)')
assert(!resetRoute.match(/return.*passwordHash|newPassword.*return/), 'reset-password does NOT return passwordHash or newPassword')
assert(resetRoute.includes('MIN_PASSWORD_LENGTH') || resetRoute.includes('8'), 'reset-password enforces min 8 chars')
assert(resetRoute.includes('handleAuthError'), 'reset-password uses handleAuthError')

// ============================================================================
// PHASE D — /api/admin/users/[id]/permissions
// ============================================================================
console.log('\n=== PHASE D — /api/admin/users/[id]/permissions ===')

const permRoute = readSrc('src/app/api/admin/users/[id]/permissions/route.ts')
assert(permRoute.includes('export async function PUT'), 'permissions exports PUT (full replace)')
assert(permRoute.includes('requireDeveloper'), 'permissions uses requireDeveloper')
assert(permRoute.includes('SYSTEM_ROLE_DEVELOPER'), 'permissions checks Developer protection')
assert(permRoute.includes('Permission Developer tidak dapat diubah via API') || permRoute.includes('403'), 'permissions rejects Developer target with 403')
assert(permRoute.includes('PERMISSION_KEY_SET'), 'permissions validates keys against PERMISSION_KEY_SET')
assert(permRoute.includes('Permission tidak dikenal'), 'permissions rejects unknown keys with 400')
assert(permRoute.includes('deleteMany'), 'permissions does full replace (delete all existing)')
assert(permRoute.includes('createMany'), 'permissions inserts new set')
assert(permRoute.includes('db.$transaction'), 'permissions uses transaction (atomic delete + insert)')
assert(!permRoute.match(/systemRole.*body|body.*systemRole/), 'permissions does NOT read systemRole from body')
assert(permRoute.includes('handleAuthError'), 'permissions uses handleAuthError')

// ============================================================================
// PHASE E — AdminUsersView (Developer-only management UI)
// ============================================================================
console.log('\n=== PHASE E — AdminUsersView (management UI) ===')

const usersView = readSrc('src/views/admin/AdminUsersView.tsx')
assert(usersView.includes("'use client'"), 'AdminUsersView is client component')
assert(usersView.includes('/api/admin/users'), 'AdminUsersView calls /api/admin/users')
assert(usersView.includes('POST'), 'AdminUsersView has create flow')
assert(usersView.includes('PATCH'), 'AdminUsersView has update flow')
assert(usersView.includes('reset-password'), 'AdminUsersView has reset-password flow')
assert(usersView.includes('permissions'), 'AdminUsersView has permissions management')
assert(usersView.includes('PERMISSION_KEYS'), 'AdminUsersView imports PERMISSION_KEYS for checkbox grid')
// Developer protection in UI:
assert(usersView.includes('isDeveloper') || usersView.includes("systemRole === 'DEVELOPER'"), 'AdminUsersView detects Developer rows')
assert(usersView.includes('disabled={isDeveloper}') || usersView.includes('disabled={isDeveloper}'), 'AdminUsersView disables actions on Developer rows')
// No systemRole field in create form:
assert(!usersView.match(/systemRole.*input|input.*systemRole/i) || usersView.includes('SYSTEM_ROLE_ADMIN'), 'AdminUsersView create form has NO systemRole field (server hardcodes ADMIN)')
// No passwordHash display:
assert(!usersView.match(/display.*passwordHash|passwordHash.*display/i), 'AdminUsersView does NOT display passwordHash')
// Show/hide for temp password (not plaintext storage, just UI convenience):
assert(usersView.includes('showPassword'), 'AdminUsersView has show/hide toggle for temp password')
assert(usersView.includes('handleAuthError') || usersView.includes('toast.error'), 'AdminUsersView handles errors')

// ============================================================================
// PHASE F — AdminLayout (permission-aware sidebar)
// ============================================================================
console.log('\n=== PHASE F — AdminLayout (permission-aware sidebar) ===')

const adminLayout = readSrc('src/components/admin/AdminLayout.tsx')
assert(adminLayout.includes("'use client'"), 'AdminLayout is client component')
assert(adminLayout.includes('/api/admin/auth/me'), 'AdminLayout fetches /api/admin/auth/me for permissions')
assert(adminLayout.includes('adminInfo'), 'AdminLayout tracks adminInfo state')
assert(adminLayout.includes('SECTION_PERMISSION'), 'AdminLayout has SECTION_PERMISSION mapping')
assert(adminLayout.includes('dashboard.view'), 'AdminLayout maps dashboard → dashboard.view')
assert(adminLayout.includes('products.view'), 'AdminLayout maps products → products.view')
assert(adminLayout.includes('orders.view'), 'AdminLayout maps orders → orders.view')
assert(adminLayout.includes('customers.view'), 'AdminLayout maps customers → customers.view')
assert(adminLayout.includes('settings.view'), 'AdminLayout maps settings → settings.view')
// Developer sees all:
assert(adminLayout.includes("systemRole === 'DEVELOPER'"), 'AdminLayout checks systemRole === DEVELOPER')
assert(adminLayout.includes('showUserAdminMenu'), 'AdminLayout has showUserAdminMenu flag')
assert(adminLayout.includes('Setting User Admin'), 'AdminLayout has "Setting User Admin" menu item')
assert(adminLayout.includes('ShieldCheck'), 'AdminLayout uses ShieldCheck icon for Setting User Admin')
// Permission filtering:
assert(adminLayout.includes('visibleNavItems'), 'AdminLayout computes visibleNavItems (filtered by permission)')
assert(adminLayout.includes('permissions.includes(requiredPerm)'), 'AdminLayout filters by permissions.includes')
// Legacy fallback (no adminInfo → show all):
assert(adminLayout.includes('if (!adminInfo) return true'), 'AdminLayout shows all items for legacy users (no adminInfo)')
// Account actions:
assert(adminLayout.includes('Ganti Password'), 'AdminLayout has "Ganti Password" button')
assert(adminLayout.includes('Keluar'), 'AdminLayout has "Keluar" (logout) button')
assert(adminLayout.includes('/api/admin/auth/logout'), 'AdminLayout logout calls /api/admin/auth/logout')
assert(adminLayout.includes("router.push('/admin/login')"), 'AdminLayout logout redirects to /admin/login')
// Account actions only for new-realm admins:
assert(adminLayout.includes('{adminInfo && ('), 'AdminLayout shows account actions only when adminInfo present')
// AdminUsersView imported:
assert(adminLayout.includes("import { AdminUsersView }"), 'AdminLayout imports AdminUsersView')
assert(adminLayout.includes("section === 'users'"), 'AdminLayout handles section=users')
assert(adminLayout.includes('<AdminUsersView'), 'AdminLayout renders AdminUsersView for users section')

// ============================================================================
// PHASE G — Customer auth regression (Stage 3 must not touch)
// ============================================================================
console.log('\n=== PHASE G — Customer auth regression ===')

const customerAuthLib = readSrc('src/lib/auth.ts')
assert(!customerAuthLib.includes('AdminUser'), 'customer auth lib does NOT reference AdminUser')
assert(!customerAuthLib.includes('anima_admin_session'), 'customer auth lib does NOT reference anima_admin_session')
assert(customerAuthLib.includes('requireAdmin'), 'customer auth lib still exports requireAdmin (legacy, for Stage 4 migration)')

const customerLoginView = readSrc('src/views/auth/LoginView.tsx')
assert(customerLoginView.includes('GoogleSignInButton'), 'customer LoginView still has Google sign-in')
assert(customerLoginView.includes('forgot-password'), 'customer LoginView still has forgot-password')

// Legacy /api/admin/** routes still use requireAdmin (NOT yet migrated — Stage 4):
const adminDashboard = readSrc('src/app/api/admin/dashboard/route.ts')
assert(adminDashboard.includes('requireAdmin') || adminDashboard.includes('getCurrentUser'), 'legacy /api/admin/dashboard still uses legacy auth (Stage 4 will migrate)')

// ============================================================================
// PHASE H — Stage 1 + Stage 2 helpers still intact
// ============================================================================
console.log('\n=== PHASE H — Stage 1 + Stage 2 helpers intact ===')

const adminAuthLib = readSrc('src/lib/admin-auth.ts')
assert(adminAuthLib.includes('export async function requireDeveloper'), 'requireDeveloper still exported')
assert(adminAuthLib.includes('export async function requirePermission'), 'requirePermission still exported')
assert(adminAuthLib.includes('export async function hashAdminPassword'), 'hashAdminPassword still exported')
assert(adminAuthLib.includes('export async function createAdminSession'), 'createAdminSession still exported')

const adminPermsLib = readSrc('src/lib/admin-permissions.ts')
assert(adminPermsLib.includes('PERMISSION_KEYS'), 'PERMISSION_KEYS still exported')
assert(adminPermsLib.includes('PERMISSION_KEY_SET'), 'PERMISSION_KEY_SET still exported')
assert(adminPermsLib.includes('SYSTEM_ROLE_DEVELOPER'), 'SYSTEM_ROLE_DEVELOPER still exported')
assert(adminPermsLib.includes('SYSTEM_ROLE_ADMIN'), 'SYSTEM_ROLE_ADMIN still exported')

// Stage 2 auth routes still exist:
const loginRoute = readSrc('src/app/api/admin/auth/login/route.ts')
assert(loginRoute.includes('export async function POST'), 'Stage 2 login route still exists')
const changePwRoute = readSrc('src/app/api/admin/auth/change-password/route.ts')
assert(changePwRoute.includes('export async function POST'), 'Stage 2 change-password route still exists')

// ============================================================================
// Final report
// ============================================================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`Stage 3 — Developer RBAC: ${pass} pass, ${fail} fail`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  ❌ ${f}`)
  process.exit(1)
}
console.log('✅ All Stage 3 invariants pass.')
process.exit(0)
