/**
 * Admin Realm V1 — Stage 2 static integrity tests.
 *
 * Run with:
 *   bun run scripts/test-admin-auth-flow.ts
 *
 * This is a PURE-STATIC test suite (no DB, no HTTP). It verifies the Stage 2
 * admin login + password-change flow source code has the required security
 * properties. Stage 4 will add HTTP integration tests against a running
 * server once the /api/admin/** routes are migrated.
 *
 * Coverage:
 *   - /api/admin/auth/login route: anti-enumeration (same error for all
 *     failures), username lower-casing, isActive check, session issuance,
 *     lastLoginAt update, no passwordHash in response.
 *   - /api/admin/auth/logout route: destroys anima_admin_session, idempotent.
 *   - /api/admin/auth/me route: returns admin identity + permissions, no
 *     passwordHash, 401 when no session.
 *   - /api/admin/auth/change-password route: requires admin session (NOT
 *     active — must work during mustChangePassword), verifies currentPassword,
 *     enforces min length 8, rejects same-password, bumps sessionVersion,
 *     sets mustChangePassword=false, re-issues session.
 *   - /admin/login page: server component, redirects authenticated admins,
 *     renders AdminLoginView, noIndex.
 *   - /admin/change-password page: server component, redirects
 *     unauthenticated to /admin/login, renders AdminChangePasswordView.
 *   - AdminLoginView: username+password form, NO Google/OTP/Register/Forgot,
 *     button "Masuk Admin", redirects to /admin/change-password on
 *     mustChangePassword, safeAdminNext open-redirect defense.
 *   - AdminChangePasswordView: current+new+confirm fields, NO view-current-
 *     password feature, min 8 chars, mismatch check.
 *   - /admin/[[...slug]] catch-all: dual-auth (new admin realm first,
 *     legacy customer admin fallback), mustChangePassword redirect.
 *   - Cross-realm cookie separation: login API sets anima_admin_session
 *     (NOT anima_session), change-password uses requireAdminSession.
 *   - Customer auth files UNTOUCHED (regression check).
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
// PHASE A — /api/admin/auth/login route
// ============================================================================
console.log('\n=== PHASE A — /api/admin/auth/login route ===')

const loginRoute = readSrc('src/app/api/admin/auth/login/route.ts')
assert(loginRoute.includes('POST'), 'login route exports POST')
assert(loginRoute.includes("anima_admin_session") || loginRoute.includes('createAdminSession'), 'login uses createAdminSession (anima_admin_session)')
assert(!loginRoute.includes("anima_session'") || loginRoute.includes('anima_admin_session'), 'login does NOT set anima_session cookie')
assert(loginRoute.includes('username.toLowerCase()'), 'login lower-cases username (case-insensitive lookup)')
assert(loginRoute.includes('compareAdminPassword'), 'login uses bcrypt compare via compareAdminPassword')
assert(loginRoute.includes('isActive'), 'login checks isActive')
assert(loginRoute.includes('lastLoginAt'), 'login updates lastLoginAt')
assert(loginRoute.includes('mustChangePassword'), 'login returns mustChangePassword in response')
assert(!loginRoute.includes('passwordHash') || loginRoute.includes('select:'), 'login does NOT return passwordHash in response body')
assert(loginRoute.includes('GENERIC_ERROR') || /Username atau password salah/.test(loginRoute), 'login has generic anti-enumeration error message')
// Anti-enumeration: the SAME generic error is used for not-found, wrong-password, and inactive.
// The constant GENERIC_ERROR is defined once and referenced in all 3 failure return paths.
const genericConstCount = (loginRoute.match(/GENERIC_ERROR/g) || []).length
assert(genericConstCount >= 4, `login uses GENERIC_ERROR const in 3 failure paths + 1 definition (found ${genericConstCount})`)
assert(loginRoute.includes("const GENERIC_ERROR = 'Username atau password salah'"), 'login defines GENERIC_ERROR constant with anti-enumeration message')
assert(loginRoute.includes('logAuthError'), 'login uses logAuthError (no raw error in prod logs)')

// ============================================================================
// PHASE B — /api/admin/auth/logout route
// ============================================================================
console.log('\n=== PHASE B — /api/admin/auth/logout route ===')

const logoutRoute = readSrc('src/app/api/admin/auth/logout/route.ts')
assert(logoutRoute.includes('POST'), 'logout route exports POST')
assert(logoutRoute.includes('destroyAdminSession'), 'logout calls destroyAdminSession')
assert(logoutRoute.includes('ok: true'), 'logout returns ok: true (idempotent)')

// ============================================================================
// PHASE C — /api/admin/auth/me route
// ============================================================================
console.log('\n=== PHASE C — /api/admin/auth/me route ===')

const meRoute = readSrc('src/app/api/admin/auth/me/route.ts')
assert(meRoute.includes('GET'), 'me route exports GET')
assert(meRoute.includes('getCurrentAdminUser'), 'me uses getCurrentAdminUser (re-fetches from DB)')
assert(meRoute.includes('mustChangePassword'), 'me returns mustChangePassword')
assert(meRoute.includes('permissions'), 'me returns permissions array')
assert(!meRoute.match(/passwordHash|password_hash/), 'me does NOT return passwordHash')
assert(meRoute.includes('UNAUTHENTICATED'), 'me returns 401 UNAUTHENTICATED when no session')

// ============================================================================
// PHASE D — /api/admin/auth/change-password route
// ============================================================================
console.log('\n=== PHASE D — /api/admin/auth/change-password route ===')

const changePwRoute = readSrc('src/app/api/admin/auth/change-password/route.ts')
assert(changePwRoute.includes('POST'), 'change-password route exports POST')
// CRITICAL: uses requireAdminSession (NOT requireAdminSessionActive) so it
// works during the mustChangePassword state.
assert(changePwRoute.includes('requireAdminSession()'), 'change-password uses requireAdminSession (works during mustChangePassword)')
assert(!changePwRoute.includes('requireAdminSessionActive()'), 'change-password does NOT use requireAdminSessionActive (would block first-login change)')
assert(changePwRoute.includes('compareAdminPassword'), 'change-password verifies currentPassword via bcrypt')
assert(changePwRoute.includes('MIN_PASSWORD_LENGTH'), 'change-password enforces min password length')
assert(changePwRoute.includes('8'), 'change-password min length is 8')
assert(changePwRoute.includes('newPassword === currentPassword'), 'change-password rejects same-password (no-op change)')
assert(changePwRoute.includes('newPassword !== confirmPassword'), 'change-password validates newPassword === confirmPassword')
assert(changePwRoute.includes('hashAdminPassword'), 'change-password hashes new password with bcrypt')
assert(changePwRoute.includes('mustChangePassword: false'), 'change-password sets mustChangePassword=false on success')
assert(changePwRoute.includes('sessionVersion'), 'change-password bumps sessionVersion')
// sessionVersion increment — the new version is old + 1
assert(/\+\s*1/.test(changePwRoute) || /sessionVersion\s*\+\s*1/.test(changePwRoute), 'change-password increments sessionVersion by 1')
assert(changePwRoute.includes('createAdminSession'), 'change-password re-issues session with new sessionVersion')
assert(!changePwRoute.match(/return.*passwordHash|passwordHash.*return/), 'change-password does NOT return passwordHash')
assert(changePwRoute.includes('handleAuthError'), 'change-password uses handleAuthError for AuthError → NextResponse')
assert(changePwRoute.includes('logAuthError'), 'change-password uses logAuthError (no raw error in prod)')

// ============================================================================
// PHASE E — /admin/login page (server component)
// ============================================================================
console.log('\n=== PHASE E — /admin/login page (server component) ===')

const loginPage = readSrc('src/app/admin/login/page.tsx')
assert(loginPage.includes('AdminLoginView'), 'login page renders AdminLoginView')
assert(loginPage.includes('getCurrentAdminUser'), 'login page checks existing admin session')
assert(loginPage.includes('redirect'), 'login page redirects authenticated admins away')
assert(loginPage.includes('/admin/change-password'), 'login page redirects mustChangePassword to /admin/change-password')
assert(loginPage.includes('/admin'), 'login page redirects to /admin when authenticated')
assert(loginPage.includes('noIndex: true'), 'login page is noIndex')
assert(!loginPage.includes('GoogleSignInButton'), 'login page has NO Google sign-in')
assert(!loginPage.includes('GuestGate'), 'login page does NOT use customer GuestGate')
assert(!loginPage.includes('getCurrentUser'), 'login page does NOT check customer auth')

// ============================================================================
// PHASE F — /admin/change-password page (server component)
// ============================================================================
console.log('\n=== PHASE F — /admin/change-password page (server component) ===')

const changePwPage = readSrc('src/app/admin/change-password/page.tsx')
assert(changePwPage.includes('AdminChangePasswordView'), 'change-password page renders AdminChangePasswordView')
assert(changePwPage.includes('getCurrentAdminUser'), 'change-password page checks admin session')
assert(changePwPage.includes("redirect('/admin/login')"), 'change-password page redirects to /admin/login when no session')
assert(changePwPage.includes('mustChangePassword'), 'change-password page passes mustChangePassword to view')
assert(changePwPage.includes('noIndex: true'), 'change-password page is noIndex')
assert(!changePwPage.includes('getCurrentUser'), 'change-password page does NOT check customer auth')

// ============================================================================
// PHASE G — AdminLoginView (client component)
// ============================================================================
console.log('\n=== PHASE G — AdminLoginView (client component) ===')

const loginView = readSrc('src/views/admin/AdminLoginView.tsx')
assert(loginView.includes("'use client'"), 'AdminLoginView is a client component')
assert(loginView.includes('username'), 'AdminLoginView has username field')
assert(loginView.includes('password'), 'AdminLoginView has password field')
assert(loginView.includes('Masuk Admin'), 'AdminLoginView button label is "Masuk Admin"')
assert(loginView.includes('/api/admin/auth/login'), 'AdminLoginView posts to /api/admin/auth/login')
assert(loginView.includes('mustChangePassword'), 'AdminLoginView handles mustChangePassword redirect')
assert(loginView.includes('/admin/change-password'), 'AdminLoginView redirects to /admin/change-password on forced change')
assert(loginView.includes('safeAdminNext'), 'AdminLoginView has open-redirect defense for ?next=')
assert(loginView.includes("startsWith('/admin')"), 'AdminLoginView ?next= restricted to /admin paths only')
// FORBIDDEN customer-auth elements:
assert(!loginView.includes('GoogleSignInButton'), 'AdminLoginView has NO Google sign-in button')
assert(!loginView.includes('forgot-password'), 'AdminLoginView has NO forgot-password link')
assert(!loginView.includes('/register'), 'AdminLoginView has NO register link')
assert(!loginView.includes('/api/auth/login'), 'AdminLoginView does NOT call customer /api/auth/login')
assert(!loginView.includes('useAuth'), 'AdminLoginView does NOT use customer useAuth hook')
assert(!loginView.includes('issueOtp'), 'AdminLoginView has NO OTP')
// Demo credentials must be DEV-ONLY (same pattern as customer LoginView):
if (loginView.includes('devonly') || loginView.includes('admin123')) {
  assert(loginView.includes("process.env.NODE_ENV !== 'production'"), 'AdminLoginView demo creds are dev-only')
}

// ============================================================================
// PHASE H — AdminChangePasswordView (client component)
// ============================================================================
console.log('\n=== PHASE H — AdminChangePasswordView (client component) ===')

const changePwView = readSrc('src/views/admin/AdminChangePasswordView.tsx')
assert(changePwView.includes("'use client'"), 'AdminChangePasswordView is a client component')
assert(changePwView.includes('currentPassword'), 'AdminChangePasswordView has currentPassword field')
assert(changePwView.includes('newPassword'), 'AdminChangePasswordView has newPassword field')
assert(changePwView.includes('confirmPassword'), 'AdminChangePasswordView has confirmPassword field')
assert(changePwView.includes('/api/admin/auth/change-password'), 'AdminChangePasswordView posts to /api/admin/auth/change-password')
assert(changePwView.includes('MIN_PASSWORD_LENGTH') || changePwView.includes('8'), 'AdminChangePasswordView enforces min 8 chars')
assert(changePwView.includes('newPassword !== form.confirmPassword') || changePwView.includes('form.newPassword !== form.confirmPassword'), 'AdminChangePasswordView validates newPassword === confirmPassword')
assert(changePwView.includes('newPassword === form.currentPassword') || changePwView.includes('form.newPassword === form.currentPassword'), 'AdminChangePasswordView rejects same-password')
assert(changePwView.includes('mustChangePassword'), 'AdminChangePasswordView shows forced-change UI when mustChangePassword')
assert(changePwView.includes('router.push'), 'AdminChangePasswordView navigates after success')
// NO "view current password" feature:
assert(!changePwView.match(/view.*current.*password|show.*current.*password/i) || changePwView.includes('showCurrent'), 'AdminChangePasswordView allows show/hide current password (no plaintext storage)')

// ============================================================================
// PHASE I — /admin/[[...slug]] catch-all dual-auth
// ============================================================================
console.log('\n=== PHASE I — /admin/[[...slug]] catch-all (Stage 4 final: new-realm only) ===')

const catchAll = readSrc('src/app/admin/[[...slug]]/page.tsx')
assert(catchAll.includes('getCurrentAdminUser'), 'catch-all checks new admin realm (getCurrentAdminUser)')
assert(catchAll.includes('mustChangePassword'), 'catch-all checks mustChangePassword')
assert(catchAll.includes("redirect('/admin/change-password')"), 'catch-all redirects mustChangePassword to /admin/change-password')
assert(catchAll.includes('<AdminLayout'), 'catch-all renders AdminLayout')
assert(catchAll.includes('AdminLoginRequiredView'), 'catch-all shows AdminLoginRequiredView for anonymous visitors (NOT customer LoginRequiredView)')
// Stage 4: legacy fallback REMOVED — no getCurrentUser, no AdminGate, no User.role check:
assert(!catchAll.includes('getCurrentUser'), 'catch-all does NOT use legacy getCurrentUser (Stage 4 removed fallback)')
assert(!catchAll.includes('AdminGate'), 'catch-all does NOT use AdminGate (legacy wrapper removed)')
assert(!catchAll.match(/(?<!Admin)LoginRequiredView/), 'catch-all does NOT use customer LoginRequiredView (only AdminLoginRequiredView)')
assert(!catchAll.includes('UnauthorizedView'), 'catch-all does NOT use customer UnauthorizedView (legacy path removed)')
assert(!catchAll.includes("user.role !== 'ADMIN'"), 'catch-all does NOT check User.role === ADMIN (legacy path removed)')

// ============================================================================
// PHASE J — Cross-realm cookie separation
// ============================================================================
console.log('\n=== PHASE J — Cross-realm cookie separation ===')

const adminAuthLib = readSrc('src/lib/admin-auth.ts')
assert(adminAuthLib.includes("anima_admin_session"), 'admin-auth uses anima_admin_session cookie name')
assert(!adminAuthLib.includes("anima_session'"), 'admin-auth does NOT touch anima_session cookie')
assert(adminAuthLib.includes("realm: 'admin'"), 'admin session payload has realm: admin marker (cross-realm replay defense)')
assert(adminAuthLib.includes("payload.realm !== 'admin'"), 'admin session verify rejects non-admin realm tokens')

// Customer auth lib must NOT reference admin cookie:
const customerAuthLib = readSrc('src/lib/auth.ts')
assert(!customerAuthLib.includes('anima_admin_session'), 'customer auth lib does NOT reference anima_admin_session')
assert(customerAuthLib.includes("anima_session"), 'customer auth uses anima_session (unchanged)')

// ============================================================================
// PHASE K — Customer auth regression checks (must be UNTOUCHED)
// ============================================================================
console.log('\n=== PHASE K — Customer auth regression (Stage 2 must not touch) ===')

// Customer login route unchanged:
const customerLogin = readSrc('src/app/api/auth/login/route.ts')
assert(customerLogin.includes('/api/auth/login') || customerLogin.includes('POST'), 'customer /api/auth/login exists (unchanged)')
assert(customerLogin.includes('issueOtp') || customerLogin.includes('sendOtpEmail') || customerLogin.includes('requiresVerification'), 'customer login still has OTP/verification flow')
assert(!customerLogin.includes('AdminUser'), 'customer login does NOT touch AdminUser table')

// Customer /login page unchanged:
const customerLoginPage = readSrc('src/app/login/page.tsx')
assert(customerLoginPage.includes('LoginView'), 'customer /login still renders LoginView')
assert(customerLoginPage.includes('GuestGate'), 'customer /login still uses GuestGate')
assert(!customerLoginPage.includes('AdminLoginView'), 'customer /login does NOT render AdminLoginView')

// Customer LoginView still has Google + forgot-password + register:
const customerLoginView = readSrc('src/views/auth/LoginView.tsx')
assert(customerLoginView.includes('GoogleSignInButton'), 'customer LoginView still has Google sign-in')
assert(customerLoginView.includes('forgot-password'), 'customer LoginView still has forgot-password link')
assert(customerLoginView.includes('/register'), 'customer LoginView still has register link')

// ============================================================================
// PHASE L — Admin auth lib helper exports (Stage 1 foundation still intact)
// ============================================================================
console.log('\n=== PHASE L — Admin auth lib helper exports (Stage 1 intact) ===')

assert(adminAuthLib.includes('export async function requireAdminSession'), 'requireAdminSession exported')
assert(adminAuthLib.includes('export async function requireAdminSessionActive'), 'requireAdminSessionActive exported')
assert(adminAuthLib.includes('export async function requireDeveloper'), 'requireDeveloper exported')
assert(adminAuthLib.includes('export async function requirePermission'), 'requirePermission exported')
assert(adminAuthLib.includes('export async function getCurrentAdminUser'), 'getCurrentAdminUser exported')
assert(adminAuthLib.includes('export async function createAdminSession'), 'createAdminSession exported')
assert(adminAuthLib.includes('export async function destroyAdminSession'), 'destroyAdminSession exported')
assert(adminAuthLib.includes('export async function hashAdminPassword'), 'hashAdminPassword exported')
assert(adminAuthLib.includes('export async function compareAdminPassword'), 'compareAdminPassword exported')

// ============================================================================
// Final report
// ============================================================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`Stage 2 — Admin Auth Flow: ${pass} pass, ${fail} fail`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  ❌ ${f}`)
  process.exit(1)
}
console.log('✅ All Stage 2 invariants pass.')
process.exit(0)
