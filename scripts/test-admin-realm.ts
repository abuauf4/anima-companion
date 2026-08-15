/**
 * Admin Realm V1 — Stage 1 static integrity tests.
 *
 * Run with:
 *   bun run scripts/test-admin-realm.ts
 *
 * This is a PURE-STATIC test suite (no DB, no HTTP). It verifies:
 *   - Prisma schema source contains AdminUser + AdminPermission models with
 *     the required fields, unique constraints, and indexes.
 *   - admin-permissions.ts exports PERMISSION_KEYS covering every real
 *     admin menu item (no invented features).
 *   - admin-auth.ts exports the required helpers + uses the anima_admin_session
 *     cookie name + re-fetches AdminUser from DB on every request + checks
 *     sessionVersion + checks isActive + checks mustChangePassword + DEVELOPER
 *     bypasses permission checks + cross-realm replay defense (realm: 'admin'
 *     marker in payload).
 *   - .env.example documents DEVELOPER_USERNAME / DEVELOPER_PASSWORD /
 *     DEVELOPER_DISPLAY_NAME.
 *   - prisma/seed.ts has an idempotent bootstrapDeveloperAdmin function that
 *     does NOT overwrite an existing developer.
 *
 * The assertions are static source/string checks. They cannot be defeated by
 * runtime DB state. Exit code is 0 if all scenarios pass, 1 otherwise.
 *
 * Stage 2/3/4 will add HTTP integration tests (admin login, password change,
 * permission deny, developer bypass, customer cookie rejected) once those
 * routes exist. For now, Stage 1 verifies the FOUNDATION is correct.
 */

// ----- Safety guard -----
if (process.env.NODE_ENV === 'production') {
  console.error('REFUSING TO RUN: NODE_ENV is "production".')
  console.error('This script reads source files only; still, refuse prod by convention.')
  process.exit(2)
}

import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  PERMISSION_KEYS,
  PERMISSION_KEY_SET,
  isValidPermissionKey,
  isDeveloper,
  isValidSystemRole,
  SYSTEM_ROLE_DEVELOPER,
  SYSTEM_ROLE_ADMIN,
} from '../src/lib/admin-permissions'

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
// PHASE A — Prisma schema source checks (AdminUser + AdminPermission)
// ============================================================================
console.log('\n=== PHASE A — Prisma schema (AdminUser + AdminPermission) ===')

const schema = readSrc('prisma/schema.prisma')

// AdminUser model exists with required fields
assert(schema.includes('model AdminUser {'), 'AdminUser model declared')
assert(/username\s+String\s+@unique/.test(schema), 'AdminUser.username is UNIQUE')
assert(/passwordHash\s+String/.test(schema), 'AdminUser.passwordHash is String (no plaintext)')
assert(!/password\s+String\s+@default/.test(schema), 'AdminUser has NO plaintext password field')
assert(/displayName\s+String/.test(schema), 'AdminUser.displayName is String')
assert(/systemRole\s+String\s+@default\("ADMIN"\)/.test(schema), 'AdminUser.systemRole defaults to ADMIN')
assert(/isActive\s+Boolean\s+@default\(true\)/.test(schema), 'AdminUser.isActive defaults to true')
assert(/mustChangePassword\s+Boolean\s+@default\(true\)/.test(schema), 'AdminUser.mustChangePassword defaults to true')
assert(/sessionVersion\s+Int\s+@default\(0\)/.test(schema), 'AdminUser.sessionVersion defaults to 0')
assert(/createdByAdminId\s+String\?/.test(schema), 'AdminUser.createdByAdminId is nullable (self-FK)')
assert(/lastLoginAt\s+DateTime\?/.test(schema), 'AdminUser.lastLoginAt is nullable')
assert(/createdAt\s+DateTime\s+@default\(now\(\)\)/.test(schema), 'AdminUser.createdAt defaults to now()')
assert(/updatedAt\s+DateTime\s+@updatedAt/.test(schema), 'AdminUser.updatedAt is @updatedAt')

// Self-referential FK
assert(/createdBy\s+AdminUser\?\s+@relation\("AdminCreatedBy"/.test(schema), 'AdminUser.createdBy self-relation')
assert(/createdAdmins\s+AdminUser\[\]\s+@relation\("AdminCreatedBy"\)/.test(schema), 'AdminUser.createdAdmins self-relation')
assert(/@@index\(\[createdByAdminId\]\)/.test(schema), 'AdminUser has index on createdByAdminId')

// AdminPermission model
assert(schema.includes('model AdminPermission {'), 'AdminPermission model declared')
assert(/adminUserId\s+String/.test(schema), 'AdminPermission.adminUserId')
assert(/permissionKey\s+String/.test(schema), 'AdminPermission.permissionKey')
assert(/@@unique\(\[adminUserId,\s*permissionKey\]\)/.test(schema), 'AdminPermission unique on (adminUserId, permissionKey)')
assert(/@@index\(\[adminUserId\]\)/.test(schema), 'AdminPermission index on adminUserId')
assert(/onDelete:\s*Cascade/.test(schema), 'AdminPermission cascades on admin delete')

// Schema is additive — User table not dropped, role column not dropped
assert(/model User \{/.test(schema), 'User model still present (customer registry untouched)')
assert(/role\s+String\s+@default\("CUSTOMER"\)/.test(schema), 'User.role column still present (deprecated but not dropped)')

// ============================================================================
// PHASE B — admin-permissions.ts exports
// ============================================================================
console.log('\n=== PHASE B — admin-permissions.ts ===')

// Every actual admin menu item has a corresponding permission key
// (derived from AdminLayout.NAV_ITEMS: dashboard, products, categories,
// orders, customers, banners, testimonials, faqs, vouchers, settings)
const expectedKeys = [
  'dashboard.view',
  'products.view', 'products.manage',
  'categories.view', 'categories.manage',
  'orders.view', 'orders.manage',
  'customers.view', 'customers.export',
  'banners.view', 'banners.manage',
  'testimonials.view', 'testimonials.manage',
  'faqs.view', 'faqs.manage',
  'vouchers.view', 'vouchers.manage',
  'settings.view', 'settings.manage',
]
for (const k of expectedKeys) {
  assert(PERMISSION_KEYS.includes(k as any), `PERMISSION_KEYS contains "${k}"`)
}

// No invented features (no payment, no loyalty, no doorprize, no apple login)
const forbiddenKeys = ['payment', 'loyalty', 'doorprize', 'apple', 'finance', 'wallet']
for (const bad of forbiddenKeys) {
  const matches = PERMISSION_KEYS.filter((k) => k.toLowerCase().includes(bad))
  assert(matches.length === 0, `PERMISSION_KEYS has NO "${bad}" key (out of scope)`)
}

// isValidPermissionKey
assert(isValidPermissionKey('dashboard.view') === true, 'isValidPermissionKey("dashboard.view") === true')
assert(isValidPermissionKey('products.manage') === true, 'isValidPermissionKey("products.manage") === true')
assert(isValidPermissionKey('nonexistent.foo') === false, 'isValidPermissionKey("nonexistent.foo") === false')
assert(isValidPermissionKey('') === false, 'isValidPermissionKey("") === false')
assert(isValidPermissionKey(null) === false, 'isValidPermissionKey(null) === false')
assert(isValidPermissionKey(undefined) === false, 'isValidPermissionKey(undefined) === false')
assert(isValidPermissionKey(123) === false, 'isValidPermissionKey(123) === false')

// PERMISSION_KEY_SET matches PERMISSION_KEYS
assert(PERMISSION_KEY_SET.size === PERMISSION_KEYS.length, 'PERMISSION_KEY_SET size matches PERMISSION_KEYS length')
for (const k of PERMISSION_KEYS) {
  assert(PERMISSION_KEY_SET.has(k), `PERMISSION_KEY_SET has "${k}"`)
}

// System role helpers
assert(SYSTEM_ROLE_DEVELOPER === 'DEVELOPER', 'SYSTEM_ROLE_DEVELOPER === "DEVELOPER"')
assert(SYSTEM_ROLE_ADMIN === 'ADMIN', 'SYSTEM_ROLE_ADMIN === "ADMIN"')
assert(isDeveloper('DEVELOPER') === true, 'isDeveloper("DEVELOPER") === true')
assert(isDeveloper('ADMIN') === false, 'isDeveloper("ADMIN") === false')
assert(isValidSystemRole('DEVELOPER') === true, 'isValidSystemRole("DEVELOPER") === true')
assert(isValidSystemRole('ADMIN') === true, 'isValidSystemRole("ADMIN") === true')
assert(isValidSystemRole('SUPERUSER') === false, 'isValidSystemRole("SUPERUSER") === false (no escalation)')
assert(isValidSystemRole(null) === false, 'isValidSystemRole(null) === false')

// ============================================================================
// PHASE C — admin-auth.ts source invariants
// ============================================================================
console.log('\n=== PHASE C — admin-auth.ts source invariants ===')

const adminAuth = readSrc('src/lib/admin-auth.ts')

// Cookie name
assert(adminAuth.includes("ADMIN_SESSION_COOKIE = 'anima_admin_session'"), 'uses anima_admin_session cookie (NOT anima_session)')
assert(!adminAuth.includes("SESSION_COOKIE = 'anima_session'"), 'admin-auth does NOT reference customer cookie name')

// Session TTL — 8h, shorter than customer 7d
assert(/ADMIN_SESSION_MAX_AGE\s*=\s*60\s*\*\s*60\s*\*\s*8/.test(adminAuth), 'admin session TTL = 8 hours (shorter than customer 7d)')

// Cookie flags
assert(/httpOnly:\s*true/.test(adminAuth), 'admin cookie is HttpOnly')
assert(/secure:\s*process\.env\.NODE_ENV\s*===\s*'production'/.test(adminAuth), 'admin cookie is Secure in production')
assert(/sameSite:\s*'lax'/.test(adminAuth), 'admin cookie is SameSite=lax')
assert(/maxAge:\s*ADMIN_SESSION_MAX_AGE/.test(adminAuth), 'admin cookie has maxAge')
assert(/path:\s*'\/'/.test(adminAuth), 'admin cookie path=/')

// Realm marker — cross-realm replay defense
assert(/realm:\s*'admin'/.test(adminAuth), 'admin payload includes realm: "admin" marker')
assert(/payload\.realm\s*!==\s*'admin'/.test(adminAuth), 'verify rejects payload without realm="admin" (cross-realm defense)')

// Re-fetches AdminUser from DB on every request
assert(/db\.adminUser\.findUnique/.test(adminAuth), 'getCurrentAdminUser re-fetches AdminUser from DB')
assert(/select:\s*{[\s\S]*?systemRole:\s*true/.test(adminAuth), 'selects systemRole from DB (not from cookie)')
assert(/isActive:\s*true/.test(adminAuth), 'selects isActive from DB (not from cookie)')
assert(/mustChangePassword:\s*true/.test(adminAuth), 'selects mustChangePassword from DB (not from cookie)')
assert(/sessionVersion:\s*true/.test(adminAuth), 'selects sessionVersion from DB (not from cookie)')
assert(/permissions:\s*{\s*select:\s*{\s*permissionKey:\s*true\s*}\s*}/.test(adminAuth), 'selects permissions from DB (not from cookie)')

// sessionVersion check — invalidation on password reset
assert(/payload\.sessionVersion\s*!==\s*admin\.sessionVersion/.test(adminAuth), 'compares cookie sessionVersion to DB sessionVersion')

// isActive check
assert(/if\s*\(!admin\.isActive\)\s*return\s*null/.test(adminAuth), 'returns null if admin.isActive === false')

// Required exported helpers
assert(/export\s+async\s+function\s+requireAdminSession\b/.test(adminAuth), 'exports requireAdminSession')
assert(/export\s+async\s+function\s+requireAdminSessionActive\b/.test(adminAuth), 'exports requireAdminSessionActive (mustChangePassword gate)')
assert(/export\s+async\s+function\s+requireDeveloper\b/.test(adminAuth), 'exports requireDeveloper')
assert(/export\s+async\s+function\s+requirePermission\b/.test(adminAuth), 'exports requirePermission')
assert(/export\s+async\s+function\s+hasPermission\b/.test(adminAuth), 'exports hasPermission (non-throwing)')
assert(/export\s+async\s+function\s+getCurrentAdminUser\b/.test(adminAuth), 'exports getCurrentAdminUser')
assert(/export\s+async\s+function\s+createAdminSession\b/.test(adminAuth), 'exports createAdminSession')
assert(/export\s+async\s+function\s+destroyAdminSession\b/.test(adminAuth), 'exports destroyAdminSession')
assert(/export\s+async\s+function\s+hashAdminPassword\b/.test(adminAuth), 'exports hashAdminPassword')
assert(/export\s+async\s+function\s+compareAdminPassword\b/.test(adminAuth), 'exports compareAdminPassword')

// requireAdminSessionActive throws FORBIDDEN if mustChangePassword
assert(/admin\.mustChangePassword[\s\S]{0,80}throw\s+new\s+AuthError\('FORBIDDEN'\)/.test(adminAuth), 'requireAdminSessionActive throws FORBIDDEN if mustChangePassword')

// requireDeveloper checks systemRole
assert(/admin\.systemRole\s*!==\s*SYSTEM_ROLE_DEVELOPER/.test(adminAuth), 'requireDeveloper checks systemRole === DEVELOPER')

// requirePermission — DEVELOPER bypass
assert(/admin\.systemRole\s*===\s*SYSTEM_ROLE_DEVELOPER[\s\S]{0,10}return\s+admin/.test(adminAuth), 'requirePermission: DEVELOPER bypasses check')
// requirePermission — ADMIN must have key
assert(/!admin\.permissions\.includes\(key\)[\s\S]{0,80}throw\s+new\s+AuthError\('FORBIDDEN'\)/.test(adminAuth), 'requirePermission: ADMIN without key → FORBIDDEN')

// requirePermission validates key at runtime
assert(/isValidPermissionKey\(key\)/.test(adminAuth), 'requirePermission validates key at runtime (typo defense)')

// bcrypt cost 10 — matches customer auth
assert(/bcrypt\.hash\(password,\s*10\)/.test(adminAuth), 'hashAdminPassword uses bcrypt cost 10 (matches customer)')

// AUTH_SECRET required in production, dev fallback
assert(/process\.env\.AUTH_SECRET/.test(adminAuth), 'reads AUTH_SECRET env')
assert(/NODE_ENV\s*===\s*'production'/.test(adminAuth), 'throws in production if AUTH_SECRET missing')
assert(/DEV_FALLBACK_SECRET/.test(adminAuth), 'dev fallback secret for non-production')

// ============================================================================
// PHASE D — .env.example documents DEVELOPER_* vars
// ============================================================================
console.log('\n=== PHASE D — .env.example DEVELOPER_* documentation ===')

const envExample = readSrc('.env.example')

assert(envExample.includes('DEVELOPER_USERNAME='), '.env.example documents DEVELOPER_USERNAME')
assert(envExample.includes('DEVELOPER_PASSWORD='), '.env.example documents DEVELOPER_PASSWORD')
assert(envExample.includes('DEVELOPER_DISPLAY_NAME='), '.env.example documents DEVELOPER_DISPLAY_NAME')
assert(envExample.includes('NEVER prefix with NEXT_PUBLIC_'), '.env.example warns DEVELOPER_* is server-only')
assert(envExample.includes('Idempotent'), '.env.example documents idempotent bootstrap')
assert(envExample.includes('mustChangePassword'), '.env.example documents mustChangePassword behavior')

// ============================================================================
// PHASE E — prisma/seed.ts bootstrap is idempotent
// ============================================================================
console.log('\n=== PHASE E — prisma/seed.ts developer bootstrap idempotency ===')

const seed = readSrc('prisma/seed.ts')

assert(/async\s+function\s+bootstrapDeveloperAdmin\b/.test(seed), 'seed.ts has bootstrapDeveloperAdmin function')
assert(/db\.adminUser\.findUnique\(\s*{\s*where:\s*{\s*username\s*}\s*}\s*\)/.test(seed), 'bootstrap looks up existing AdminUser by username')
assert(/if\s*\(existing\)[\s\S]{0,200}return/.test(seed), 'bootstrap returns early if developer already exists (idempotent — no overwrite)')
assert(!/db\.adminUser\.update\(\s*{\s*where:\s*{\s*username\s*}/.test(seed), 'bootstrap does NOT call update by username (no overwrite)')
assert(/systemRole:\s*'DEVELOPER'/.test(seed), 'bootstrap creates with systemRole=DEVELOPER')
assert(/mustChangePassword:\s*false/.test(seed), 'bootstrap developer mustChangePassword=false (operator chose password)')
assert(/isActive:\s*true/.test(seed), 'bootstrap developer isActive=true')
assert(/sessionVersion:\s*0/.test(seed), 'bootstrap developer sessionVersion=0')

// Demo developer is HARD-DISABLED in production
assert(/devonly\/devonly123/.test(seed), 'demo developer credentials in dev mode')
assert(/IS_PROD\s*=\s*process\.env\.NODE_ENV\s*===\s*'production'/.test(seed), 'seed checks NODE_ENV for production gate')
// The dev-only demo path is gated by !IS_PROD
assert(/!IS_PROD/.test(seed), 'demo developer is gated by !IS_PROD (hard-disabled in production)')

// Username is lowercased before insert/lookup
assert(/username\s*=\s*envUsername\.toLowerCase\(\)/.test(seed), 'username normalized to lower-case')
assert(/username\s*=\s*'devonly'/.test(seed), 'demo username is literal "devonly" (lowercase)')

// ============================================================================
// PHASE F — SQL reference file exists for paper-trail
// ============================================================================
console.log('\n=== PHASE F — SQL reference file (paper-trail) ===')

const sqlRef = readSrc('prisma/sql/20260816-admin-realm-v1.sql')
assert(sqlRef.includes('CREATE TABLE "AdminUser"'), 'SQL ref creates AdminUser table')
assert(sqlRef.includes('CREATE TABLE "AdminPermission"'), 'SQL ref creates AdminPermission table')
assert(sqlRef.includes('AdminUser_username_key'), 'SQL ref: AdminUser.username unique index')
assert(sqlRef.includes('AdminPermission_adminUserId_permissionKey_key'), 'SQL ref: AdminPermission (adminUserId, permissionKey) unique index')
assert(/ADDITIVE ONLY|ADDITIVE/i.test(sqlRef), 'SQL ref documents additive-only intent')
assert(!/DROP TABLE|DROP COLUMN/i.test(sqlRef), 'SQL ref has NO DROP statements (additive only)')

// ============================================================================
// PHASE G — Prisma client recognizes new models (generated)
// ============================================================================
console.log('\n=== PHASE G — Prisma client generated models ===')

// Read the generated PrismaClient type signature to confirm both models
// are exposed. This catches a stale prisma client (e.g. if generate was
// skipped after the schema edit).
const prismaClientPath = resolve(repoRoot, 'node_modules/.prisma/client/index.d.ts')
let prismaClient: string
try {
  prismaClient = readFileSync(prismaClientPath, 'utf8')
} catch {
  // Try alternate location
  const alt = resolve(repoRoot, 'node_modules/@prisma/client/index.d.ts')
  prismaClient = readFileSync(alt, 'utf8')
}
assert(/get\s+adminUser\(\)/.test(prismaClient) || /adminUser\s*\??\s*:/.test(prismaClient), 'Prisma client exposes db.adminUser')
assert(/get\s+adminPermission\(\)/.test(prismaClient) || /adminPermission\s*\??\s*:/.test(prismaClient), 'Prisma client exposes db.adminPermission')

// ============================================================================
// Final report
// ============================================================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`Stage 1 — Admin Realm foundation: ${pass} pass, ${fail} fail`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  ❌ ${f}`)
  process.exit(1)
}
console.log('✅ All Stage 1 invariants pass.')
process.exit(0)
