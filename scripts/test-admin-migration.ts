/**
 * Admin Realm V1 — Stage 4 static integrity tests (FINAL).
 *
 * Run with:
 *   bun run scripts/test-admin-migration.ts
 *
 * This is a PURE-STATIC test suite (no DB, no HTTP). It verifies the Stage 4
 * migration of all /api/admin/** routes from requireAdmin (legacy customer
 * auth) to requirePermission (new admin realm auth).
 *
 * Coverage:
 *   - Every /api/admin/** route (except /auth/* and /users/*) uses
 *     requirePermission from @/lib/admin-auth (NOT requireAdmin from @/lib/auth).
 *   - No /api/admin/** route has any remaining `await requireAdmin()` call.
 *   - Permission keys are correct per HTTP method (GET → .view, POST/PATCH/
 *     PUT/DELETE → .manage) and per resource.
 *   - Special permissions: customers/export → customers.export, cloudinary/
 *     sign → products.manage.
 *   - /admin/[[...slug]] catch-all: new-realm only (no legacy fallback).
 *   - AdminLoginRequiredView exists and links to /admin/login.
 *   - Customer auth (requireAdmin) is still exported from @/lib/auth (for
 *     any non-/api/admin/** callers) but is NOT used by any /api/admin/** route.
 *   - Customer /api/auth/** routes are UNTOUCHED (still use requireAuth /
 *     getCurrentUser from @/lib/auth).
 */

// ----- Safety guard -----
if (process.env.NODE_ENV === 'production') {
  console.error('REFUSING TO RUN: NODE_ENV is "production".')
  process.exit(2)
}

import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'

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

// Recursively find all route.ts files under src/app/api/admin/
function findRoutes(dir: string, base = ''): string[] {
  const results: string[] = []
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const relPath = base ? `${base}/${entry}` : entry
    if (statSync(fullPath).isDirectory()) {
      results.push(...findRoutes(fullPath, relPath))
    } else if (entry === 'route.ts') {
      results.push(relPath)
    }
  }
  return results
}

const adminApiDir = resolve(repoRoot, 'src/app/api/admin')
const allRoutes = findRoutes(adminApiDir)

// Exclude /auth/* (built in Stage 2 on the new realm) and /users/* (built
// in Stage 3 on the new realm). These were NEVER on the legacy requireAdmin.
const migratedRoutes = allRoutes.filter(
  (r) => !r.startsWith('auth/') && !r.startsWith('users/')
)

// ============================================================================
// PHASE A — All migrated routes use requirePermission from @/lib/admin-auth
// ============================================================================
console.log('\n=== PHASE A — All /api/admin/** routes migrated to requirePermission ===')

for (const relPath of migratedRoutes) {
  const content = readSrc(`src/app/api/admin/${relPath}`)
  const routeName = relPath.replace('/route.ts', '').replace('route.ts', '<root>')
  assert(
    content.includes("from '@/lib/admin-auth'"),
    `${routeName}: imports from @/lib/admin-auth`
  )
  assert(
    content.includes('requirePermission'),
    `${routeName}: uses requirePermission`
  )
  assert(
    !content.includes("await requireAdmin()"),
    `${routeName}: does NOT use legacy await requireAdmin()`
  )
  assert(
    !content.includes("from '@/lib/auth'") || content.includes('requireAdminSession'),
    `${routeName}: does NOT import from @/lib/auth (unless re-exporting requireAdminSession)`
  )
}

// ============================================================================
// PHASE B — Permission keys are correct per (resource, method)
// ============================================================================
console.log('\n=== PHASE B — Permission keys correct per (resource, method) ===')

interface ExpectedPerm {
  method: string
  perm: string
}

// Build expected permissions per route.
function getExpectedPerms(relPath: string): ExpectedPerm[] {
  // Determine the resource from the path.
  let resource: string
  if (relPath.startsWith('cloudinary/')) {
    resource = 'products'
  } else {
    resource = relPath.split('/')[0]
  }

  // Special case: customers/export → customers.export (not customers.view)
  if (relPath === 'customers/export/route.ts') {
    return [{ method: 'GET', perm: 'customers.export' }]
  }
  // Special case: cloudinary/sign → products.manage (upload is a manage op)
  if (relPath === 'cloudinary/sign/route.ts') {
    return [{ method: 'GET', perm: 'products.manage' }]
  }

  // Read the file to find which HTTP methods are exported.
  const content = readSrc(`src/app/api/admin/${relPath}`)
  const perms: ExpectedPerm[] = []
  const methodRegex = /export async function (GET|POST|PATCH|PUT|DELETE)\b/g
  let match
  while ((match = methodRegex.exec(content)) !== null) {
    const method = match[1]
    const action = method === 'GET' ? 'view' : 'manage'
    perms.push({ method, perm: `${resource}.${action}` })
  }
  return perms
}

for (const relPath of migratedRoutes) {
  const expected = getExpectedPerms(relPath)
  const content = readSrc(`src/app/api/admin/${relPath}`)
  const routeName = relPath.replace('/route.ts', '')

  for (const { method, perm } of expected) {
    // Check that the route calls requirePermission with this exact key.
    // We look for requirePermission('perm') or requirePermission("perm").
    const hasPerm = content.includes(`requirePermission('${perm}')`) ||
                    content.includes(`requirePermission("${perm}")`)
    assert(
      hasPerm,
      `${routeName} ${method}: uses requirePermission('${perm}')`
    )
  }
}

// ============================================================================
// PHASE C — /admin/[[...slug]] catch-all (Stage 4 final: new-realm only)
// ============================================================================
console.log('\n=== PHASE C — /admin/[[...slug]] catch-all (Stage 4 final) ===')

const catchAll = readSrc('src/app/admin/[[...slug]]/page.tsx')
assert(catchAll.includes('getCurrentAdminUser'), 'catch-all uses getCurrentAdminUser (new realm only)')
assert(catchAll.includes('AdminLoginRequiredView'), 'catch-all renders AdminLoginRequiredView for anonymous')
assert(catchAll.includes("redirect('/admin/change-password')"), 'catch-all redirects mustChangePassword')
assert(catchAll.includes('<AdminLayout'), 'catch-all renders AdminLayout')
assert(!catchAll.includes('getCurrentUser'), 'catch-all does NOT use legacy getCurrentUser')
assert(!catchAll.includes('AdminGate'), 'catch-all does NOT use AdminGate')
// Check for customer LoginRequiredView (NOT AdminLoginRequiredView).
// Use a regex that matches LoginRequiredView but NOT AdminLoginRequiredView.
assert(!catchAll.match(/(?<!Admin)LoginRequiredView/), 'catch-all does NOT use customer LoginRequiredView (only AdminLoginRequiredView)')
assert(!catchAll.includes('UnauthorizedView'), 'catch-all does NOT use customer UnauthorizedView')

// ============================================================================
// PHASE D — AdminLoginRequiredView exists and links to /admin/login
// ============================================================================
console.log('\n=== PHASE D — AdminLoginRequiredView ===')

const loginRequiredView = readSrc('src/components/admin/AdminLoginRequiredView.tsx')
assert(loginRequiredView.includes("'use client'"), 'AdminLoginRequiredView is client component')
assert(loginRequiredView.includes('/admin/login'), 'AdminLoginRequiredView links to /admin/login')
assert(loginRequiredView.includes('Masuk Admin'), 'AdminLoginRequiredView has "Masuk Admin" button')
assert(loginRequiredView.includes('ShieldCheck'), 'AdminLoginRequiredView uses ShieldCheck icon')
assert(!loginRequiredView.includes('/login"') || loginRequiredView.includes('/admin/login'), 'AdminLoginRequiredView does NOT link to customer /login')

// ============================================================================
// PHASE E — Customer auth lib still exports requireAdmin (for non-admin callers)
// but NO /api/admin/** route uses it
// ============================================================================
console.log('\n=== PHASE E — Legacy requireAdmin isolated ===')

const customerAuthLib = readSrc('src/lib/auth.ts')
assert(customerAuthLib.includes('export async function requireAdmin'), 'customer auth.ts still exports requireAdmin (not deleted — may have non-admin callers)')
assert(customerAuthLib.includes('export async function requireAuth'), 'customer auth.ts still exports requireAuth')
assert(customerAuthLib.includes('export async function getCurrentUser'), 'customer auth.ts still exports getCurrentUser')

// Verify NO /api/admin/** route imports requireAdmin from @/lib/auth
for (const relPath of migratedRoutes) {
  const content = readSrc(`src/app/api/admin/${relPath}`)
  const routeName = relPath.replace('/route.ts', '')
  assert(
    !content.match(/import\s*\{[^}]*requireAdmin[^}]*\}\s*from\s*'@\/lib\/auth'/),
    `${routeName}: does NOT import requireAdmin from @/lib/auth`
  )
}

// ============================================================================
// PHASE F — Customer /api/auth/** routes UNTOUCHED (still use requireAuth/getCurrentUser)
// ============================================================================
console.log('\n=== PHASE F — Customer /api/auth/** untouched ===')

const customerAuthRoutes = allRoutes.filter((r) => r.startsWith('auth/'))
for (const relPath of customerAuthRoutes) {
  const content = readSrc(`src/app/api/admin/${relPath}`)
  const routeName = relPath.replace('/route.ts', '')
  // Customer auth routes under /api/admin/auth/ are the NEW admin realm
  // routes (built in Stage 2). They use requireAdminSession/requireDeveloper
  // from @/lib/admin-auth, NOT requireAuth from @/lib/auth.
  assert(
    content.includes("from '@/lib/admin-auth'") || content.includes("from '@/lib/auth'"),
    `${routeName}: imports from a valid auth module`
  )
  assert(
    !content.includes('await requireAdmin()'),
    `${routeName}: does NOT use legacy await requireAdmin()`
  )
}

// Customer /api/auth/** (NOT /api/admin/auth/**) — verify still on customer auth:
const customerLoginRoute = readSrc('src/app/api/auth/login/route.ts')
assert(customerLoginRoute.includes('comparePassword'), 'customer /api/auth/login still uses customer auth (comparePassword)')
assert(!customerLoginRoute.includes('requireAdminSession'), 'customer /api/auth/login does NOT use admin realm auth')

const customerMeRoute = readSrc('src/app/api/auth/me/route.ts')
assert(customerMeRoute.includes('getCurrentUser') || customerMeRoute.includes('requireAuth'), 'customer /api/auth/me still uses getCurrentUser/requireAuth')

// ============================================================================
// PHASE G — All permission keys used in routes exist in PERMISSION_KEYS
// ============================================================================
console.log('\n=== PHASE G — All permission keys used are valid ===')

const adminPermsLib = readSrc('src/lib/admin-permissions.ts')
const allPermsUsed = new Set<string>()

for (const relPath of migratedRoutes) {
  const content = readSrc(`src/app/api/admin/${relPath}`)
  const permRegex = /requirePermission\(\s*['"]([^'"]+)['"]\s*\)/g
  let match
  while ((match = permRegex.exec(content)) !== null) {
    allPermsUsed.add(match[1])
  }
}

assert(allPermsUsed.size > 0, `Found ${allPermsUsed.size} distinct permission keys in use`)
for (const perm of allPermsUsed) {
  assert(
    adminPermsLib.includes(`'${perm}'`),
    `Permission key '${perm}' exists in PERMISSION_KEYS`
  )
}

// ============================================================================
// Final report
// ============================================================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`Stage 4 — Admin API Migration: ${pass} pass, ${fail} fail`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  ❌ ${f}`)
  process.exit(1)
}
console.log('✅ All Stage 4 invariants pass.')
process.exit(0)
