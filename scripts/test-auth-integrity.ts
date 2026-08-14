/**
 * Auth & Authorization Security Audit V1 — test scenarios.
 *
 * Run with:
 *   # Pure static tests (always run):
 *   bun run scripts/test-auth-integrity.ts
 *
 *   # Full HTTP integration tests (requires a running server):
 *   BASE_URL="http://localhost:3000" bun run scripts/test-auth-integrity.ts
 *
 * IMPORTANT:
 * - This script does NOT mutate the database in static mode. It only verifies
 *   the auth helpers, the redirect-safety helper, and source-level invariants.
 * - In HTTP mode (BASE_URL set), the script creates temporary QA users via
 *   /api/auth/register and cleans them up at the end. NEVER run this against
 *   a production deployment.
 * - The script aborts immediately if NODE_ENV=production (so a stray env var
 *   can never trigger HTTP tests against production).
 * - All assertions are static (no test framework). Output is human-readable.
 *   Exit code is 0 if all scenarios pass, 1 otherwise.
 *
 * Scenarios covered (per task spec point 11):
 *
 * Pure-static (always run):
 *   RED1–RED8.  safeInternalPath() open-redirect defense (literal forms)
 *   RED9–RED12. safeInternalPath() encoded-bypass / control-char / malformed-encoding defense
 *   AE1–AE4.    AuthError status code mapping + handleAuthError dispatch
 *   SRC1.       register route source does NOT destructure `role` from body
 *   SRC2.       register route hardcodes role: 'CUSTOMER' in db.user.create
 *   SRC3.       register route does NOT pass `role` from body into db.user.create
 *   SRC4.       login route does NOT accept role from body
 *   SRC5.       getCurrentUser select clause excludes password
 *   SRC6.       login + register routes use logAuthError() (no raw console.error on e.message)
 *   SRC7.       logAuthError production branch logs ONLY { event, status }
 *   SRC8.       seed.ts has NO SEED_DEMO_USERS_IN_PRODUCTION override
 *
 * HTTP integration (requires BASE_URL):
 *   AU1. unauthenticated → admin endpoint → 401
 *   AU2. authenticated non-admin → admin endpoint → 403
 *   AU3. authenticated admin → admin endpoint → 200
 *   IDOR1. customer A cannot fetch customer B's pet-profile by ID (returns 404)
 *   IDOR2. customer A cannot DELETE customer B's pet-profile (returns 404)
 *   ESC1. register with role: 'ADMIN' in body → created user is CUSTOMER, NOT admin
 *   SER1. POST /api/auth/login response body has no `password` key
 *   SER2. POST /api/auth/register response body has no `password` key
 *   SER3. GET /api/auth/me response body has no `password` key
 *   RDR1. /login?next=/checkout (real navigation not tested — safeInternalPath covers it)
 *
 * The static tests use the actual helper imports — no DB, no HTTP. They are
 * the authoritative test of the open-redirect defense and the AuthError
 * contract. The HTTP integration tests verify the wire-level behavior of
 * the route handlers; they require a running `next dev` (or staging) server
 * pointed at a non-production database.
 */

// ----- Safety guards -----
if (process.env.NODE_ENV === 'production') {
  console.error('REFUSING TO RUN: NODE_ENV is "production".')
  console.error('This script may create temporary QA users; never run against production.')
  process.exit(2)
}

import { safeInternalPath } from '../src/lib/redirect'
import { AuthError, handleAuthError } from '../src/lib/auth'
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const BASE_URL = process.env.BASE_URL || ''
const HTTP_MODE = BASE_URL.length > 0

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

function assertEqual<T>(actual: T, expected: T, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  assert(ok, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

const QA_PREFIX = `qa-authtest-${Date.now()}-`

// ============================================================================
// Pure-static tests — always run, no DB, no HTTP
// ============================================================================

function testRedirectSafety() {
  console.log('\n========================================')
  console.log('Redirect safety — safeInternalPath() unit tests')
  console.log('========================================')

  console.log('\n[RED1] Empty / null / undefined → null')
  assertEqual(safeInternalPath(''), null, 'empty string → null')
  assertEqual(safeInternalPath(null), null, 'null → null')
  assertEqual(safeInternalPath(undefined), null, 'undefined → null')
  assertEqual(safeInternalPath(123 as any), null, 'non-string → null')

  console.log('\n[RED2] Internal paths accepted')
  assertEqual(safeInternalPath('/'), '/', '/ → /')
  assertEqual(safeInternalPath('/checkout'), '/checkout', '/checkout → /checkout')
  assertEqual(safeInternalPath('/admin/orders'), '/admin/orders', '/admin/orders → /admin/orders')
  assertEqual(safeInternalPath('/products?slug=foo'), '/products?slug=foo', 'path with query accepted')
  assertEqual(safeInternalPath('/admin#section'), '/admin#section', 'path with hash accepted')

  console.log('\n[RED3] Scheme-relative URLs rejected (open-redirect defense)')
  assertEqual(safeInternalPath('//evil.example.com'), null, '//evil.example.com → null')
  assertEqual(safeInternalPath('//evil.example.com/path'), null, '//evil.example.com/path → null')
  assertEqual(safeInternalPath('/\\evil.example.com'), null, '/\\evil.example.com → null (backslash variant)')
  assertEqual(safeInternalPath('/\\\\evil.example.com'), null, '/\\\\evil.example.com → null (double backslash)')

  console.log('\n[RED4] External URLs rejected')
  assertEqual(safeInternalPath('https://evil.example.com'), null, 'https://evil.example.com → null')
  assertEqual(safeInternalPath('http://evil.example.com'), null, 'http://evil.example.com → null')
  assertEqual(safeInternalPath('https://animacompanion.id/checkout'), null, 'https://animacompanion.id/checkout → null (same-host external still rejected)')

  console.log('\n[RED5] Dangerous schemes rejected')
  assertEqual(safeInternalPath('javascript:alert(1)'), null, 'javascript:alert(1) → null')
  assertEqual(safeInternalPath('data:text/html,<script>alert(1)</script>'), null, 'data:text/html → null')
  assertEqual(safeInternalPath('mailto:foo@example.com'), null, 'mailto: → null')

  console.log('\n[RED6] Relative URLs without leading slash rejected')
  assertEqual(safeInternalPath('evil.com'), null, 'evil.com → null (no leading /)')
  assertEqual(safeInternalPath('checkout'), null, 'checkout → null (no leading /)')
  assertEqual(safeInternalPath('../admin'), null, '../admin → null (relative path)')

  console.log('\n[RED7] Path with colon AFTER ? is allowed (query param values)')
  // The colon-in-path check should only reject colons in the path SEGMENT,
  // not in the query string. /search?q=http://foo should be accepted.
  assertEqual(safeInternalPath('/search?q=http://foo'), '/search?q=http://foo', 'colon inside query is allowed')
  assertEqual(safeInternalPath('/search?q=https://evil.example.com'), '/search?q=https://evil.example.com', 'colon+slashes inside query is allowed')
  assertEqual(safeInternalPath('/products#http://foo'), '/products#http://foo', 'colon inside fragment is allowed')

  console.log('\n[RED8] Edge cases')
  assertEqual(safeInternalPath('/a/b/c'), '/a/b/c', 'deep path accepted')
  assertEqual(safeInternalPath('/../etc/passwd'), '/../etc/passwd', '/../etc/passwd accepted (harmless — same-origin 404)')
  // Note: path traversal /../etc/passwd is harmless because Next.js router
  // treats it as a same-origin path; the browser sends the request to the
  // app's own origin, where it 404s. The threat model is OPEN REDIRECT
  // (sending the user to a different origin), not same-origin path
  // traversal. So this case is correctly accepted.

  console.log('\n[RED9] Encoded // bypass (percent-encoded forward slashes)')
  // The canonical caller (URLSearchParams.get) already decodes once, but if
  // someone calls safeInternalPath on a raw still-encoded string, the
  // encoded `//` form must still be rejected. Otherwise an attacker can
  // craft a `?next=` URL whose decoded form is a scheme-relative URL.
  assertEqual(safeInternalPath('%2F%2Fevil.example.com'), null, '%2F%2Fevil.example.com → null (no leading slash)')
  assertEqual(safeInternalPath('/%2F%2Fevil.example.com'), null, '/%2F%2Fevil.example.com → null (decodes to ///evil)')
  assertEqual(safeInternalPath('/%2F%2Fevil.example.com/path'), null, '/%2F%2Fevil.example.com/path → null')
  assertEqual(safeInternalPath('/%2F%5Cevil.example.com'), null, '/%2F%5Cevil.example.com → null (decodes to //\\evil)')
  // Mixed encoded/decoded form — partial encoding must still be rejected
  // because the decoded form starts with `//`.
  assertEqual(safeInternalPath('/%2F/evil.example.com'), null, '/%2F/evil.example.com → null (decodes to ///evil)')

  console.log('\n[RED10] Encoded backslash bypass (percent-encoded backslashes)')
  assertEqual(safeInternalPath('/%5Cevil.example.com'), null, '/%5Cevil.example.com → null (decodes to /\\evil)')
  assertEqual(safeInternalPath('/%5C%5Cevil.example.com'), null, '/%5C%5Cevil.example.com → null (decodes to /\\\\evil)')
  assertEqual(safeInternalPath('/%5C/evil.example.com'), null, '/%5C/evil.example.com → null (decodes to /\\/evil)')

  console.log('\n[RED11] Control characters (0x00–0x1F, 0x7F, whitespace)')
  // Control chars in URL paths are not valid and can be used to confuse
  // log readers or downstream consumers. \t \n \r are inside the range.
  assertEqual(safeInternalPath('/\x00evil'), null, 'path with NUL → null')
  assertEqual(safeInternalPath('/\x01evil'), null, 'path with SOH (0x01) → null')
  assertEqual(safeInternalPath('/\tevil'), null, 'path with TAB → null')
  assertEqual(safeInternalPath('/\nevil'), null, 'path with LF → null')
  assertEqual(safeInternalPath('/\revil'), null, 'path with CR → null')
  assertEqual(safeInternalPath('/\x1fevil'), null, 'path with US (0x1F) → null')
  assertEqual(safeInternalPath('/\x7fevil'), null, 'path with DEL (0x7F) → null')
  // Sanity: a normal path with no control chars still passes.
  assertEqual(safeInternalPath('/checkout'), '/checkout', 'normal /checkout still accepted')

  console.log('\n[RED12] Malformed percent-encoding')
  // Malformed URI sequences cause decodeURIComponent to throw — we treat
  // any throw as a reject, because we can't safely decide what the input
  // would decode to.
  assertEqual(safeInternalPath('/%ZZevil'), null, '/%ZZevil → null (invalid hex %ZZ)')
  // NOTE: `/%2evil` is NOT malformed — `%2e` is the encoding for `.`, so
  // `decodeURIComponent('/%2evil')` returns `/.vil`, which is a safe path.
  // We exclude that case from the malformed-encoding suite. Use `/%2` (a
  // truly truncated sequence — `%` followed by only ONE hex digit and then
  // end-of-string) and `/%XY` (two non-hex digits) instead.
  assertEqual(safeInternalPath('/%2'), null, '/%2 → null (truncated %2 at end of string)')
  assertEqual(safeInternalPath('/%evil'), null, '/%evil → null (lone %)')
  assertEqual(safeInternalPath('/checkout%'), null, '/checkout% → null (trailing %)')
  assertEqual(safeInternalPath('/%2Gevil'), null, '/%2Gevil → null (invalid second hex digit)')
  assertEqual(safeInternalPath('/%G2evil'), null, '/%G2evil → null (invalid first hex digit)')
  // Sanity: a valid percent-encoded char that doesn't bypass the
  // scheme-relative check should still be accepted (e.g. %20 = space, which
  // we already reject via RED11 because it's a control char — but %41 = 'A'
  // is a normal letter and must not be rejected just because it's encoded).
  assertEqual(safeInternalPath('/search?q=%41'), '/search?q=%41', 'encoded ASCII letter in query still accepted')
}

function testAuthError() {
  console.log('\n========================================')
  console.log('AuthError + handleAuthError — unit tests')
  console.log('========================================')

  console.log('\n[AE1] AuthError status code mapping')
  const unauth = new AuthError('UNAUTHENTICATED')
  assertEqual(unauth.status, 401, 'UNAUTHENTICATED → status 401')
  assertEqual(unauth.code, 'UNAUTHENTICATED', 'UNAUTHENTICATED → code UNAUTHENTICATED')
  assertEqual(unauth.name, 'AuthError', 'name === AuthError')

  const forbidden = new AuthError('FORBIDDEN')
  assertEqual(forbidden.status, 403, 'FORBIDDEN → status 403')
  assertEqual(forbidden.code, 'FORBIDDEN', 'FORBIDDEN → code FORBIDDEN')

  console.log('\n[AE2] handleAuthError dispatches AuthError → NextResponse')
  const res1 = handleAuthError(new AuthError('UNAUTHENTICATED'))!
  assert(!!res1, 'returns non-null for AuthError')
  assert(res1.status === 401, 'UNAUTHENTICATED → 401')
  const res2 = handleAuthError(new AuthError('FORBIDDEN'))!
  assert(res2.status === 403, 'FORBIDDEN → 403')

  console.log('\n[AE3] handleAuthError returns null for non-auth errors')
  assertEqual(handleAuthError(new Error('some other error')), null, 'plain Error → null')
  assertEqual(handleAuthError(new TypeError('bad type')), null, 'TypeError → null')
  assertEqual(handleAuthError(null), null, 'null → null')
  assertEqual(handleAuthError(undefined), null, 'undefined → null')
  assertEqual(handleAuthError('string error'), null, 'string → null')

  console.log('\n[AE4] handleAuthError backwards-compat with legacy bare Error("UNAUTHORIZED"|"FORBIDDEN")')
  // The migration to AuthError should still recognize the old throw pattern
  // so any code path that hasn't been migrated yet continues to behave
  // correctly. This is critical because the auth library is shared.
  const legacy1 = handleAuthError(new Error('UNAUTHORIZED'))!
  assert(!!legacy1, 'legacy Error("UNAUTHORIZED") → non-null')
  assert(legacy1.status === 401, 'legacy UNAUTHORIZED → 401')
  const legacy2 = handleAuthError(new Error('FORBIDDEN'))!
  assert(!!legacy2, 'legacy Error("FORBIDDEN") → non-null')
  assert(legacy2.status === 403, 'legacy FORBIDDEN → 403')
}

function testSourceInvariants() {
  console.log('\n========================================')
  console.log('Source-level invariants — register route')
  console.log('========================================')

  // Load the register route source and verify it does NOT destructure
  // `role` from the request body. This is a defense-in-depth check: if a
  // future refactor accidentally adds `role` to the destructuring, the
  // test will catch it.
  const registerSrc = readFileSync(
    resolve(process.cwd(), 'src/app/api/auth/register/route.ts'),
    'utf8'
  )

  console.log('\n[SRC1] Register route destructures only safe fields from body')
  // Extract the body-destructuring line(s). We expect { email, password, name, phone }.
  const match = registerSrc.match(/const\s*\{\s*([^}]+)\s*\}\s*=\s*body/)
  assert(!!match, 'found body destructuring in register route')
  if (match) {
    const fields = match[1].split(',').map((s) => s.trim()).filter(Boolean)
    console.log(`  Body fields destructured: ${fields.join(', ')}`)
    assert(!fields.includes('role'), 'role NOT destructured from body')
    assert(!fields.includes('userId'), 'userId NOT destructured from body')
    assert(!fields.includes('id'), 'id NOT destructured from body')
    assert(fields.includes('email'), 'email is destructured')
    assert(fields.includes('password'), 'password is destructured')
    assert(fields.includes('name'), 'name is destructured')
  }

  console.log('\n[SRC2] Register route hardcodes role: "CUSTOMER" in user.create')
  // Look for `role: 'CUSTOMER'` (or "CUSTOMER") inside db.user.create call.
  assert(
    /role:\s*['"]CUSTOMER['"]/.test(registerSrc),
    'db.user.create data contains role: "CUSTOMER" (hardcoded)'
  )

  console.log('\n[SRC3] Register route does NOT pass `role` from body into db.user.create')
  // Sanity check: ensure no `role` variable (e.g. `role: role` or `role:` reading
  // from body) leaks into db.user.create. The only `role` mention should be the
  // literal `role: 'CUSTOMER'` line that hardcodes the customer role.
  assert(
    /role:\s*['"]CUSTOMER['"]/.test(registerSrc),
    "db.user.create data contains role: 'CUSTOMER' (hardcoded)"
  )
  // Ensure there is NO line of the form `role,` or `role: role` or `role: roleFromBody`
  // (which would indicate the body `role` is being passed through).
  assert(
    !/role:\s*role\b/.test(registerSrc) && !/^\s*role\s*,\s*$/m.test(registerSrc),
    "no `role` variable passthrough in db.user.create"
  )

  console.log('\n[SRC4] Login route does NOT accept role from body')
  const loginSrc = readFileSync(
    resolve(process.cwd(), 'src/app/api/auth/login/route.ts'),
    'utf8'
  )
  const loginMatch = loginSrc.match(/const\s*\{\s*([^}]+)\s*\}\s*=\s*body/)
  if (loginMatch) {
    const fields = loginMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
    console.log(`  Login body fields: ${fields.join(', ')}`)
    assert(!fields.includes('role'), 'login route does NOT read role from body')
    assert(fields.includes('email'), 'login route reads email')
    assert(fields.includes('password'), 'login route reads password')
  }

  console.log('\n[SRC5] getCurrentUser select clause excludes password')
  const authSrc = readFileSync(
    resolve(process.cwd(), 'src/lib/auth.ts'),
    'utf8'
  )
  // Verify the select clause on db.user.findUnique inside getCurrentUser
  // does NOT include password. This is the canonical password-leak defense.
  // Use [\s\S] instead of /s flag for backwards compatibility with older
  // TypeScript targets.
  const selectMatch = authSrc.match(/db\.user\.findUnique\(\{[\s\S]*?select:\s*\{([^}]+)\}[\s\S]*?\}\)/)
  if (selectMatch) {
    // Each entry in the select clause looks like "id: true" or "email: true".
    // Extract just the field name (the part before the colon).
    const selectFields = selectMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.split(':')[0].trim())
    console.log(`  getCurrentUser select fields: ${selectFields.join(', ')}`)
    assert(!selectFields.includes('password'), 'password NOT in getCurrentUser select')
    assert(selectFields.includes('id'), 'id in select')
    assert(selectFields.includes('role'), 'role in select')
  }

  console.log('\n[SRC6] Login + register routes use logAuthError() (not raw console.error on e.message)')
  // After the Auth Security V1 cleanup patch, both auth routes must call
  // `logAuthError(...)` instead of destructuring `e.message` and logging
  // it directly. This is the source-level guarantee that production logs
  // never contain Prisma error fragments.
  const loginSrcFull = readFileSync(
    resolve(process.cwd(), 'src/app/api/auth/login/route.ts'),
    'utf8'
  )
  const registerSrcFull = readFileSync(
    resolve(process.cwd(), 'src/app/api/auth/register/route.ts'),
    'utf8'
  )
  assert(/logAuthError\s*\(/.test(loginSrcFull), 'login route calls logAuthError()')
  assert(/logAuthError\s*\(/.test(registerSrcFull), 'register route calls logAuthError()')
  // Forbid the OLD pattern: `console.error(...e.message...)` or
  // `console.error(..., e)` directly on the raw error object.
  assert(
    !/console\.error\s*\([^)]*e\.message/.test(loginSrcFull),
    'login route does NOT log e.message via console.error'
  )
  assert(
    !/console\.error\s*\([^)]*e\.message/.test(registerSrcFull),
    'register route does NOT log e.message via console.error'
  )

  console.log('\n[SRC7] logAuthError production branch logs ONLY {event, status}')
  // Verify the production branch of logAuthError does NOT reference
  // e.message / e.constructor.name / e.stack. This is the structural
  // guarantee that production auth logs are fully sanitized.
  const logAuthErrorMatch = authSrc.match(
    /export\s+function\s+logAuthError[\s\S]*?^}/m
  )
  if (logAuthErrorMatch) {
    const fnSrc = logAuthErrorMatch[0]
    // Find the production branch: `if (process.env.NODE_ENV === 'production') { ... return }`
    const prodBranchMatch = fnSrc.match(
      /if\s*\(\s*process\.env\.NODE_ENV\s*===\s*['"]production['"]\s*\)\s*\{([\s\S]*?)\n\s*return\s*\}/
    )
    assert(!!prodBranchMatch, 'found logAuthError production branch')
    if (prodBranchMatch) {
      // Strip line + block comments so the regex check inspects executable
      // code only, not the docstring explaining WHY we don't log e.message.
      const prodBody = prodBranchMatch[1]
        .replace(/\/\/[^\n]*/g, '') // strip line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // strip block comments
      assert(
        !/e\.message/.test(prodBody),
        'production branch does NOT reference e.message'
      )
      assert(
        !/e\.constructor/.test(prodBody),
        'production branch does NOT reference e.constructor'
      )
      assert(
        !/e\.stack/.test(prodBody),
        'production branch does NOT reference e.stack'
      )
      assert(
        /event/.test(prodBody) && /status/.test(prodBody),
        'production branch logs only { event, status }'
      )
    }
  } else {
    assert(false, 'could not locate logAuthError function in src/lib/auth.ts')
  }

  console.log('\n[SRC8] seed.ts has NO SEED_DEMO_USERS_IN_PRODUCTION override')
  // The Auth Security V1 cleanup patch removed the SEED_DEMO_USERS_IN_PRODUCTION=1
  // escape hatch entirely. In production, demo users must be HARD-DISABLED —
  // the demo password is public in this source file and must never be
  // reachable from a production deployment, even with explicit opt-in.
  const seedSrc = readFileSync(
    resolve(process.cwd(), 'prisma/seed.ts'),
    'utf8'
  )
  // The env var name must NOT appear anywhere in seed.ts (neither as a
  // condition nor in a comment that mentions the override as available).
  // We allow it ONLY inside the comment that explicitly says it was REMOVED.
  // For the test, we simply ensure no code-path references it as a
  // conditional. The string `SEED_DEMO_USERS_IN_PRODUCTION !== '1'` was the
  // old override pattern — it must NOT be present.
  assert(
    !/SEED_DEMO_USERS_IN_PRODUCTION\s*!==\s*['"]1['"]/.test(seedSrc),
    'seed.ts does NOT use SEED_DEMO_USERS_IN_PRODUCTION !== "1" override pattern'
  )
  assert(
    !/SEED_DEMO_USERS_IN_PRODUCTION\s*===\s*['"]1['"]/.test(seedSrc),
    'seed.ts does NOT use SEED_DEMO_USERS_IN_PRODUCTION === "1" override pattern'
  )
  // The production guard must be a simple equality: SKIP = IS_PRODUCTION.
  // (No `&& ...` clause that would re-enable demo users under any condition.)
  assert(
    /SKIP_DEMO_USERS_IN_PRODUCTION\s*=\s*IS_PRODUCTION\b/.test(seedSrc),
    'seed.ts sets SKIP_DEMO_USERS_IN_PRODUCTION = IS_PRODUCTION (no override clause)'
  )
  // The bootstrap-admin path via SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD
  // must still be present (the legitimate way to create a production admin).
  assert(
    /SEED_ADMIN_EMAIL/.test(seedSrc) && /SEED_ADMIN_PASSWORD/.test(seedSrc),
    'seed.ts retains SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD bootstrap path'
  )
}

// ============================================================================
// HTTP integration tests — only run when BASE_URL is set
// ============================================================================

async function makeQaUser(email: string, password: string, role: 'CUSTOMER' | 'ADMIN') {
  return db.user.create({
    data: {
      email: `${QA_PREFIX}-${email}`,
      password: await bcrypt.hash(password, 10),
      name: `QA ${email.split('@')[0]}`,
      phone: '08123456789',
      role,
    },
    select: { id: true, email: true, role: true },
  })
}

async function login(email: string, password: string): Promise<{ cookie: string; body: any }> {
  // Hit the real /api/auth/login endpoint. Returns the Set-Cookie header
  // so we can pass it on subsequent requests.
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await res.json()
  // Extract Set-Cookie header (just the cookie=value part)
  const setCookie = res.headers.get('set-cookie') || ''
  const cookie = setCookie.split(';')[0] // e.g. "anima_session=xxx"
  return { cookie, body }
}

async function http(
  method: string,
  path: string,
  opts: { cookie?: string; body?: any } = {}
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {}
  if (opts.cookie) headers['Cookie'] = opts.cookie
  if (opts.body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  let body: any = text
  try {
    body = JSON.parse(text)
  } catch {
    // leave as text
  }
  return { status: res.status, body }
}

async function testHttpAuthBoundary(adminCookie: string, customerCookie: string) {
  console.log('\n========================================')
  console.log('HTTP auth boundary — /api/admin/* endpoints')
  console.log('========================================')

  console.log('\n[AU1] Unauthenticated → admin endpoint → 401')
  const endpoints = [
    '/api/admin/products',
    '/api/admin/orders',
    '/api/admin/customers',
    '/api/admin/vouchers',
    '/api/admin/categories',
    '/api/admin/banners',
    '/api/admin/testimonials',
    '/api/admin/faqs',
    '/api/admin/dashboard',
    '/api/admin/settings',
    '/api/admin/cloudinary/sign',
  ]
  for (const ep of endpoints) {
    const { status, body } = await http('GET', ep)
    const code = body?.code
    assert(
      status === 401 && code === 'UNAUTHENTICATED',
      `GET ${ep} unauthenticated → 401 UNAUTHENTICATED (got ${status} ${code || ''})`
    )
  }

  console.log('\n[AU2] Authenticated non-admin → admin endpoint → 403')
  for (const ep of endpoints) {
    const { status, body } = await http('GET', ep, { cookie: customerCookie })
    const code = body?.code
    assert(
      status === 403 && code === 'FORBIDDEN',
      `GET ${ep} as customer → 403 FORBIDDEN (got ${status} ${code || ''})`
    )
  }

  console.log('\n[AU3] Authenticated admin → admin endpoint → 2xx')
  // Cloudinary sign may 503 if Cloudinary is not configured — accept 200 OR 503.
  for (const ep of endpoints) {
    const { status } = await http('GET', ep, { cookie: adminCookie })
    if (ep === '/api/admin/cloudinary/sign') {
      assert(
        status === 200 || status === 503,
        `GET ${ep} as admin → 200 or 503 (Cloudinary not configured) (got ${status})`
      )
    } else {
      assert(status >= 200 && status < 300, `GET ${ep} as admin → 2xx (got ${status})`)
    }
  }
}

async function testIdor(customerACookie: string, customerBCookie: string, petProfileAId: string) {
  console.log('\n========================================')
  console.log('IDOR — pet-profile cross-user access')
  console.log('========================================')

  console.log('\n[IDOR1] Customer B cannot fetch customer A\'s pet profile by ID')
  // Note: the API has no GET /api/pet-profiles/[id] — only list endpoint
  // filtered by userId. So the test is: customer B's list does NOT include
  // customer A's pet profile ID.
  const { body: bList } = await http('GET', '/api/pet-profiles', { cookie: customerBCookie })
  const bPetIds: string[] = (bList?.petProfiles || []).map((p: any) => p.id)
  assert(
    !bPetIds.includes(petProfileAId),
    "customer B's pet-profile list does NOT include customer A's pet (IDOR-safe list filter)"
  )

  console.log('\n[IDOR2] Customer B cannot DELETE customer A\'s pet profile')
  const delRes = await http('DELETE', `/api/pet-profiles/${petProfileAId}`, { cookie: customerBCookie })
  assert(
    delRes.status === 404,
    `customer B DELETE customer A's pet → 404 (got ${delRes.status}) — does not disclose existence`
  )

  console.log('\n[IDOR3] Customer B cannot PUT customer A\'s pet profile')
  const putRes = await http('PUT', `/api/pet-profiles/${petProfileAId}`, {
    cookie: customerBCookie,
    body: { petName: 'Hacked', petTypeId: 'any', age: '1', weight: '1kg', notes: 'pwn' },
  })
  assert(
    putRes.status === 404,
    `customer B PUT customer A's pet → 404 (got ${putRes.status}) — does not disclose existence`
  )

  console.log('\n[IDOR4] Customer A CAN PUT their own pet profile')
  const ownPutRes = await http('PUT', `/api/pet-profiles/${petProfileAId}`, {
    cookie: customerACookie,
    body: { petName: 'My Pet (updated)', petTypeId: 'any', age: '2', weight: '2kg', notes: 'updated' },
  })
  assert(
    ownPutRes.status === 200,
    `customer A PUT own pet → 200 (got ${ownPutRes.status})`
  )
}

async function testEscalation() {
  console.log('\n========================================')
  console.log('Privilege escalation — register with role=ADMIN')
  console.log('========================================')

  console.log('\n[ESC1] Register with role: "ADMIN" in body → created user is CUSTOMER')
  const email = `${QA_PREFIX}-esc@example.com`
  const { status, body } = await http('POST', '/api/auth/register', {
    body: {
      email,
      password: 'escalation-test-123',
      name: 'Esc QA',
      phone: '08123456789',
      role: 'ADMIN', // <-- the attack
    },
  })
  assert(status === 200, `register returned 200 (got ${status})`)
  if (body?.user) {
    assertEqual(body.user.role, 'CUSTOMER', 'created user role is CUSTOMER, NOT ADMIN')
    assert(!body.user.password, 'response body has no password field')
  }
  // Cleanup: delete the QA user we just created.
  if (body?.user?.id) {
    await db.user.delete({ where: { id: body.user.id } }).catch(() => {})
  }
}

async function testSerialization(adminEmail: string, adminPassword: string) {
  console.log('\n========================================')
  console.log('Sensitive serialization — no password in API responses')
  console.log('========================================')

  console.log('\n[SER1] POST /api/auth/login response body has no `password` key')
  const { body: loginBody } = await login(adminEmail, adminPassword)
  assert(!!loginBody?.user, 'login returned a user object')
  if (loginBody?.user) {
    assert(!('password' in loginBody.user), 'login response.user has NO password field')
    assert(!('passwordHash' in loginBody.user), 'login response.user has NO passwordHash field')
    assert(!('hash' in loginBody.user), 'login response.user has NO hash field')
    assert(!('secret' in loginBody.user), 'login response.user has NO secret field')
    // Also confirm the raw response body string doesn't contain the bcrypt hash
    const serialized = JSON.stringify(loginBody)
    assert(!/\$2[aby]\$10\$/.test(serialized), 'response body has no bcrypt-hash-like substring')
  }

  console.log('\n[SER2] POST /api/auth/register response body has no `password` key')
  const email = `${QA_PREFIX}-ser@example.com`
  const { status, body } = await http('POST', '/api/auth/register', {
    body: { email, password: 'ser-test-123', name: 'Ser QA' },
  })
  assert(status === 200, `register returned 200 (got ${status})`)
  if (body?.user) {
    assert(!('password' in body.user), 'register response.user has NO password field')
    assert(!('passwordHash' in body.user), 'register response.user has NO passwordHash field')
    const serialized = JSON.stringify(body)
    assert(!/\$2[aby]\$10\$/.test(serialized), 'response body has no bcrypt-hash-like substring')
  }
  if (body?.user?.id) {
    await db.user.delete({ where: { id: body.user.id } }).catch(() => {})
  }

  console.log('\n[SER3] GET /api/auth/me response body has no `password` key')
  const { cookie } = await login(adminEmail, adminPassword)
  const { body: meBody } = await http('GET', '/api/auth/me', { cookie })
  assert(!!meBody?.user, '/api/auth/me returned a user object')
  if (meBody?.user) {
    assert(!('password' in meBody.user), '/api/auth/me response.user has NO password field')
    assert(!('passwordHash' in meBody.user), '/api/auth/me response.user has NO passwordHash field')
    const serialized = JSON.stringify(meBody)
    assert(!/\$2[aby]\$10\$/.test(serialized), 'response body has no bcrypt-hash-like substring')
  }
}

async function testRedirectSafetyHttp() {
  console.log('\n========================================')
  console.log('Redirect safety — ?next= behavior on /login')
  console.log('========================================')
  // The actual open-redirect defense is in safeInternalPath() — already
  // covered by the static tests above. The HTTP test would just verify
  // that navigating to /login?next=//evil.example.com does NOT result in
  // a 302 to //evil.example.com. Since /login is a Server Component that
  // renders a Client Component, there's no server-side redirect to test
  // here — the navigation happens client-side in the browser via the
  // useHashRouter.navigate() call. The static unit tests already cover
  // the helper; documenting as intentional.
  console.log('  ℹ️  Redirect-safety HTTP test is covered by static RED1–RED8 unit tests.')
  console.log('     /login renders a client component; navigation is client-side.')
}

async function cleanup() {
  console.log('\n========================================')
  console.log('Cleanup — deleting QA users + pet profiles')
  console.log('========================================')
  // Delete pet profiles owned by QA users (cascade deletes via FK onDelete: Cascade)
  const qaUsers = await db.user.findMany({
    where: { email: { startsWith: QA_PREFIX } },
    select: { id: true },
  })
  if (qaUsers.length > 0) {
    const userIds = qaUsers.map((u) => u.id)
    await db.petProfile.deleteMany({ where: { userId: { in: userIds } } })
    await db.cart.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {})
    await db.cartItem.deleteMany({
      where: { cart: { userId: { in: userIds } } },
    }).catch(() => {})
    const del = await db.user.deleteMany({ where: { id: { in: userIds } } })
    console.log(`  Deleted: ${del.count} QA users (cascaded pet profiles, cart, cart items)`)
  } else {
    console.log('  No QA users to clean up.')
  }
}

async function main() {
  console.log('========================================')
  console.log('Auth & Authorization Security Audit V1 — tests')
  console.log('========================================')
  console.log(`QA_PREFIX: ${QA_PREFIX}`)
  console.log(`HTTP mode: ${HTTP_MODE ? 'ENABLED (' + BASE_URL + ')' : 'DISABLED (BASE_URL unset)'}`)
  console.log('')

  // ----- Pure-static tests (always run) -----
  testRedirectSafety()
  testAuthError()
  testSourceInvariants()

  // ----- HTTP integration tests (only if BASE_URL is set) -----
  if (HTTP_MODE) {
    console.log('\n========================================')
    console.log('HTTP integration tests — running against ' + BASE_URL)
    console.log('========================================')

    // Setup: create QA admin + customer via DB (bypass /api/auth/register so
    // we don't pollute the test with the register flow itself).
    const adminEmail = `${QA_PREFIX}-admin@example.com`
    const customerEmailA = `${QA_PREFIX}-customerA@example.com`
    const customerEmailB = `${QA_PREFIX}-customerB@example.com`
    const adminPassword = 'qa-admin-pw-123'
    const customerPasswordA = 'qa-customer-pw-123'
    const customerPasswordB = 'qa-customer-pw-123'

    const adminUser = await makeQaUser(adminEmail, adminPassword, 'ADMIN')
    const customerA = await makeQaUser(customerEmailA, customerPasswordA, 'CUSTOMER')
    const customerB = await makeQaUser(customerEmailB, customerPasswordB, 'CUSTOMER')
    console.log(`Setup: admin=${adminUser.email}, A=${customerA.email}, B=${customerB.email}`)

    // Create a pet profile as customer A (directly via DB, so we have its ID)
    const petType = await db.petType.findFirst()
    let petProfileAId = ''
    if (petType) {
      const petA = await db.petProfile.create({
        data: {
          userId: customerA.id,
          petName: 'Pet A (QA)',
          petTypeId: petType.id,
          age: '2 tahun',
          weight: '4.5 kg',
          notes: 'QA pet profile for IDOR test',
        },
      })
      petProfileAId = petA.id
      console.log(`Setup: pet profile A created (id=${petProfileAId})`)
    } else {
      console.log('⚠️  No pet types in DB — skipping pet-profile IDOR tests.')
    }

    // Login all three users
    const adminLogin = await login(adminEmail, adminPassword)
    const aLogin = await login(customerEmailA, customerPasswordA)
    const bLogin = await login(customerEmailB, customerPasswordB)
    assert(!!adminLogin.cookie, 'admin login succeeded and returned a cookie')
    assert(!!aLogin.cookie, 'customer A login succeeded')
    assert(!!bLogin.cookie, 'customer B login succeeded')

    await testHttpAuthBoundary(adminLogin.cookie, aLogin.cookie)
    if (petProfileAId) {
      await testIdor(aLogin.cookie, bLogin.cookie, petProfileAId)
    }
    await testEscalation()
    await testSerialization(adminEmail, adminPassword)
    await testRedirectSafetyHttp()

    await cleanup()
  } else {
    console.log('\n========================================')
    console.log('HTTP integration tests — SKIPPED (BASE_URL not set)')
    console.log('========================================')
    console.log('To enable HTTP integration tests:')
    console.log('  1. Start the dev server: bun run dev')
    console.log('  2. Run with BASE_URL set:')
    console.log('     BASE_URL="http://localhost:3000" bun run scripts/test-auth-integrity.ts')
    console.log('')
    console.log('The static tests above already cover the core security invariants')
    console.log('(safeInternalPath, AuthError, source-level checks). HTTP tests')
    console.log('verify the wire-level behavior of the route handlers.')
  }

  // ----- Summary -----
  console.log('\n========================================')
  console.log(`Results: ${pass} passed, ${fail} failed`)
  console.log('========================================')
  if (fail > 0) {
    console.log('\nFailed assertions:')
    for (const f of failures) console.log(`  - ${f}`)
    process.exit(1)
  } else {
    console.log('\n✅ All scenarios passed.')
    process.exit(0)
  }
}

main()
  .catch((e) => {
    console.error('Test script crashed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
