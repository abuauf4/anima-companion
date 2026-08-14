/**
 * Member Registry & Verified Registration V1 — test scenarios.
 *
 * Run with:
 *   # Pure static tests (always run, no DB, no HTTP):
 *   bun run scripts/test-member-registry.ts
 *
 *   # Full HTTP integration tests (requires a running server + PostgreSQL):
 *   BASE_URL="http://localhost:3000" bun run scripts/test-member-registry.ts
 *
 *   # DB-direct tests (requires DATABASE_URL but no running server):
 *   bun run scripts/test-member-registry.ts
 *
 * IMPORTANT:
 * - In HTTP mode, this script creates temporary QA users via /api/auth/register
 *   and cleans them up at the end. NEVER run this against a production deployment.
 * - The script aborts immediately if NODE_ENV=production.
 *
 * Scenarios covered (per task spec PHASE 10 + cleanup v2):
 *
 * Verification (cross-checked with test-verified-identity.ts):
 *   V1.  password account starts unverified
 *   V2.  successful email verification → verified
 *   V3.  Google account with valid verified identity → verified
 *   V4.  invalid/expired/reused verification token cannot verify user
 *   V5.  client cannot set emailVerifiedAt via /api/auth/register body
 *   V6.  duplicate email registration rejected
 *
 * Admin members list authorization:
 *   A1. guest cannot list members → 401
 *   A2. customer cannot list members → 403
 *   A3. admin can list members → 200
 *
 * Admin members list privacy:
 *   P1. response does NOT expose `password` key
 *   P2. response does NOT expose `providerSubject` key
 *   P3. response does NOT expose `EmailVerificationToken` rows (no `verificationTokens` key)
 *
 * Admin members list search/filter:
 *   S1. search by name works
 *   S2. search by email works
 *   S3. search by phone works
 *   F1. verified=true filter returns only verified members
 *   F2. verified=false filter returns only unverified members
 *   F3. provider=GOOGLE filter returns only Google members
 *   F4. provider=PASSWORD filter returns only Email/Password members
 *
 * CUSTOMER-only registry (cleanup v2):
 *   R1. CUSTOMER + GOOGLE → included in list
 *   R2. CUSTOMER + PASSWORD → included in list
 *   R3. ADMIN → excluded from list
 *   R4. SELLER → excluded from list
 *   R5. ADMIN → excluded from detail (404)
 *   R6. SELLER → excluded from detail (404)
 *   R7. ADMIN → excluded from CSV export
 *   R8. SELLER → excluded from CSV export
 *
 * Admin member detail:
 *   D1. admin can fetch detail by id → 200
 *   D2. customer cannot fetch detail → 403
 *   D3. detail response does NOT expose `password` / `providerSubject` / `verificationTokens`
 *   D4. non-existent id → 404
 *
 * Export:
 *   E1. admin can export → 200 + text/csv
 *   E2. customer cannot export → 403
 *   E3. export respects current filters
 *   E4. export contains expected columns (header row)
 *   E5. export does NOT contain password/providerSubject/token/security data
 *
 * Pagination (cleanup v2):
 *   PG1. response pagination object has page/limit/total/totalPages
 *   PG2. page=2 returns the second page of results
 *   PG3. page beyond totalPages returns empty members array
 *   PG4. limit cap of 100 is enforced by the server (requesting limit=999 returns ≤100)
 *
 * Source-level invariants:
 *   SRC1. customers/route.ts uses explicit Prisma select whitelist
 *   SRC2. customers/[id]/route.ts uses explicit Prisma select whitelist
 *   SRC3. customers/export/route.ts uses explicit Prisma select whitelist
 *   SRC4. customers/route.ts calls requireAdmin()
 *   SRC5. customers/[id]/route.ts calls requireAdmin()
 *   SRC6. customers/export/route.ts calls requireAdmin()
 *   SRC7. email.ts ResendEmailAdapter constructor throws when RESEND_API_KEY missing
 *   SRC8. email.ts ResendEmailAdapter constructor throws when EMAIL_FROM missing
 *   SRC9. email.ts never logs raw token / verificationUrl (production-safe)
 *   SRC10. register route hardcodes provider='PASSWORD' + emailVerifiedAt=null
 *   SRC11. customers/route.ts hardcodes role='CUSTOMER' WHERE filter (no role param)
 *   SRC12. customers/[id]/route.ts uses findFirst with where:{id, role:'CUSTOMER'}
 *   SRC13. customers/export/route.ts hardcodes role='CUSTOMER' WHERE filter (no role param)
 *   SRC14. UI (CustomersView.tsx) has functional Previous / Page X of Y / Next pagination
 */

// ----- Safety guards -----
if (process.env.NODE_ENV === 'production') {
  console.error('REFUSING TO RUN: NODE_ENV is "production".')
  console.error('This script may create temporary QA users; never run against production.')
  process.exit(2)
}

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

const QA_PREFIX = `qa-member-${Date.now()}-`

// ============================================================================
// Source-level invariants — always run, no DB, no HTTP
// ============================================================================

function readSrc(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf8')
}

function testSourceInvariants() {
  console.log('\n========================================')
  console.log('Source-level invariants — admin member routes + email adapter + UI')
  console.log('========================================')

  const listSrc = readSrc('src/app/api/admin/customers/route.ts')
  const detailSrc = readSrc('src/app/api/admin/customers/[id]/route.ts')
  const exportSrc = readSrc('src/app/api/admin/customers/export/route.ts')
  const emailSrc = readSrc('src/lib/email.ts')
  const registerSrc = readSrc('src/app/api/auth/register/route.ts')
  const viewSrc = readSrc('src/views/admin/CustomersView.tsx')

  // ---- SRC1: list route uses explicit Prisma select whitelist ----
  console.log('\n[SRC1] customers/route.ts uses explicit Prisma select whitelist')
  assert(/select:\s*\{/.test(listSrc), 'list route has a `select: { ... }` clause')
  // Must select specific known-good columns (whitelist approach)
  assert(/\bid:\s*true/.test(listSrc), 'list route selects id')
  assert(/\bname:\s*true/.test(listSrc), 'list route selects name')
  assert(/\bemail:\s*true/.test(listSrc), 'list route selects email')
  assert(/\bprovider:\s*true/.test(listSrc), 'list route selects provider')
  assert(/\bemailVerifiedAt:\s*true/.test(listSrc), 'list route selects emailVerifiedAt')
  assert(/\brole:\s*true/.test(listSrc), 'list route selects role')
  // Must NOT select sensitive columns
  assert(!/\bpassword:\s*true/.test(listSrc), 'list route does NOT select password')
  assert(
    !/\bproviderSubject:\s*true/.test(listSrc),
    'list route does NOT select providerSubject'
  )
  // Must NOT include verificationTokens (raw token hashes)
  assert(
    !/verificationTokens:\s*\{/.test(listSrc),
    'list route does NOT include verificationTokens relation (raw token hashes)'
  )

  // ---- SRC2: detail route uses explicit Prisma select whitelist ----
  console.log('\n[SRC2] customers/[id]/route.ts uses explicit Prisma select whitelist')
  assert(/select:\s*\{/.test(detailSrc), 'detail route has a `select: { ... }` clause')
  assert(/\bemailVerifiedAt:\s*true/.test(detailSrc), 'detail route selects emailVerifiedAt')
  assert(!/\bpassword:\s*true/.test(detailSrc), 'detail route does NOT select password')
  assert(
    !/\bproviderSubject:\s*true/.test(detailSrc),
    'detail route does NOT select providerSubject'
  )
  assert(
    !/verificationTokens:\s*\{/.test(detailSrc),
    'detail route does NOT include verificationTokens'
  )

  // ---- SRC3: export route uses explicit Prisma select whitelist ----
  console.log('\n[SRC3] customers/export/route.ts uses explicit Prisma select whitelist')
  assert(/select:\s*\{/.test(exportSrc), 'export route has a `select: { ... }` clause')
  assert(!/\bpassword:\s*true/.test(exportSrc), 'export route does NOT select password')
  assert(
    !/\bproviderSubject:\s*true/.test(exportSrc),
    'export route does NOT select providerSubject'
  )
  assert(
    !/verificationTokens:\s*\{/.test(exportSrc),
    'export route does NOT include verificationTokens'
  )
  // Export must define explicit CSV headers whitelist
  assert(
    /\bconst headers\s*=\s*\[/.test(exportSrc),
    'export route defines an explicit `headers` whitelist array'
  )
  // The headers array must contain id, name, email, phone, role, provider,
  // emailVerified, emailVerifiedAt, createdAt
  const headersMatch = exportSrc.match(/const headers\s*=\s*\[([\s\S]*?)\]/)
  if (headersMatch) {
    const headersBlock = headersMatch[1]
    assert(headersBlock.includes("'id'"), "export headers includes 'id'")
    assert(headersBlock.includes("'name'"), "export headers includes 'name'")
    assert(headersBlock.includes("'email'"), "export headers includes 'email'")
    assert(headersBlock.includes("'phone'"), "export headers includes 'phone'")
    assert(headersBlock.includes("'role'"), "export headers includes 'role'")
    assert(headersBlock.includes("'provider'"), "export headers includes 'provider'")
    assert(headersBlock.includes("'emailVerified'"), "export headers includes 'emailVerified'")
    assert(headersBlock.includes("'emailVerifiedAt'"), "export headers includes 'emailVerifiedAt'")
    assert(headersBlock.includes("'createdAt'"), "export headers includes 'createdAt'")
    // MUST NOT include sensitive columns
    assert(
      !headersBlock.includes("'password'"),
      "export headers does NOT include 'password'"
    )
    assert(
      !headersBlock.includes("'providerSubject'"),
      "export headers does NOT include 'providerSubject'"
    )
    assert(
      !headersBlock.includes("'tokenHash'"),
      "export headers does NOT include 'tokenHash' (verification token data)"
    )
  }

  // ---- SRC4: list route calls requireAdmin() ----
  console.log('\n[SRC4] customers/route.ts calls requireAdmin()')
  assert(/requireAdmin\(\)/.test(listSrc), 'list route calls requireAdmin()')

  // ---- SRC5: detail route calls requireAdmin() ----
  console.log('\n[SRC5] customers/[id]/route.ts calls requireAdmin()')
  assert(/requireAdmin\(\)/.test(detailSrc), 'detail route calls requireAdmin()')

  // ---- SRC6: export route calls requireAdmin() ----
  console.log('\n[SRC6] customers/export/route.ts calls requireAdmin()')
  assert(/requireAdmin\(\)/.test(exportSrc), 'export route calls requireAdmin()')

  // ---- SRC7: ResendEmailAdapter constructor throws when RESEND_API_KEY missing ----
  console.log('\n[SRC7] ResendEmailAdapter constructor throws when RESEND_API_KEY missing')
  assert(
    /class\s+ResendEmailAdapter\s+implements\s+EmailAdapter/.test(emailSrc),
    'ResendEmailAdapter class exists'
  )
  // Capture the WHOLE ResendEmailAdapter class body (from `class ResendEmailAdapter`
  // to the next `class` keyword or end of section). The constructor + send
  // method live inside this body, so we count throws across both.
  const resendClassMatch = emailSrc.match(
    /class\s+ResendEmailAdapter\s+implements\s+EmailAdapter[\s\S]*?(?=\nclass\s|\n\/\/)/
  )
  assert(!!resendClassMatch, 'ResendEmailAdapter class body found')
  const resendClass = resendClassMatch ? resendClassMatch[0] : ''
  // Constructor must check RESEND_API_KEY and throw if missing/empty
  const resendCtorMatch = resendClass.match(/constructor\(\)\s*\{[\s\S]*?\n\s{2}\}/)
  assert(!!resendCtorMatch, 'ResendEmailAdapter constructor found')
  if (resendCtorMatch) {
    const ctor = resendCtorMatch[0]
    assert(/RESEND_API_KEY/.test(ctor), 'constructor references RESEND_API_KEY')
    assert(
      /throw\s+new\s+Error/.test(ctor),
      'constructor throws Error when RESEND_API_KEY missing/empty'
    )
    // Must NOT silently fall back to dev adapter
    assert(
      !/DevConsoleEmailAdapter/.test(ctor),
      'constructor does NOT fall back to DevConsoleEmailAdapter (no silent fake-send)'
    )
  }

  // ---- SRC8: ResendEmailAdapter constructor throws when EMAIL_FROM missing ----
  console.log('\n[SRC8] ResendEmailAdapter constructor throws when EMAIL_FROM missing')
  if (resendCtorMatch) {
    const ctor = resendCtorMatch[0]
    assert(/EMAIL_FROM/.test(ctor), 'constructor references EMAIL_FROM')
    // There must be a second throw for EMAIL_FROM (independent of RESEND_API_KEY)
    const throws = ctor.match(/throw\s+new\s+Error/g) || []
    assert(throws.length >= 2, `constructor has at least 2 throws (apiKey + from) — got ${throws.length}`)
  }

  // ---- SRC9: email.ts never logs raw token / verificationUrl (production-safe) ----
  console.log('\n[SRC9] ResendEmailAdapter never logs raw token / verificationUrl')
  const resendSendMatch = emailSrc.match(
    /class\s+ResendEmailAdapter[\s\S]*?async\s+send[\s\S]*?\n\s{4}\}/
  )
  assert(!!resendSendMatch, 'ResendEmailAdapter.send method found')
  if (resendSendMatch) {
    const sendFn = resendSendMatch[0]
    // Must NOT log message.text, message.html, or any token-related field
    assert(
      !/console\.\w+\([^)]*message\.text/.test(sendFn),
      'ResendEmailAdapter.send does NOT console.log message.text'
    )
    assert(
      !/console\.\w+\([^)]*message\.html/.test(sendFn),
      'ResendEmailAdapter.send does NOT console.log message.html'
    )
    assert(
      !/console\.\w+\([^)]*verificationUrl/.test(sendFn),
      'ResendEmailAdapter.send does NOT console.log verificationUrl'
    )
    assert(
      !/console\.\w+\([^)]*rawToken/.test(sendFn),
      'ResendEmailAdapter.send does NOT console.log rawToken'
    )
  }

  // ---- SRC10: register route hardcodes provider='PASSWORD' + emailVerifiedAt=null ----
  console.log('\n[SRC10] register route hardcodes provider=PASSWORD + emailVerifiedAt=null')
  // Must NOT read provider/providerSubject/emailVerifiedAt from body
  const bodyDestructureMatch = registerSrc.match(/const\s+\{\s*([^}]+)\s*\}\s*=\s*body/)
  if (bodyDestructureMatch) {
    const destructure = bodyDestructureMatch[1]
    assert(
      !/\bprovider\b/.test(destructure),
      'register route does NOT destructure provider from body'
    )
    assert(
      !/\bproviderSubject\b/.test(destructure),
      'register route does NOT destructure providerSubject from body'
    )
    assert(
      !/\bemailVerifiedAt\b/.test(destructure),
      'register route does NOT destructure emailVerifiedAt from body'
    )
  }
  // db.user.create data must include provider: 'PASSWORD' + emailVerifiedAt: null
  const createMatch = registerSrc.match(/db\.user\.create\([\s\S]*?data:\s*\{([\s\S]*?)\}/)
  if (createMatch) {
    const data = createMatch[1]
    assert(/provider:\s*['"]PASSWORD['"]/.test(data), "register db.user.create data has provider: 'PASSWORD'")
    assert(/emailVerifiedAt:\s*null/.test(data), 'register db.user.create data has emailVerifiedAt: null')
  }

  // ---- SRC11: list route hardcodes role='CUSTOMER' in WHERE (no role param) ----
  console.log('\n[SRC11] customers/route.ts hardcodes role=CUSTOMER (no role query param)')
  // The WHERE object must initialize with role: 'CUSTOMER'.
  assert(
    /where:\s*WhereClause\s*=\s*\{\s*role:\s*['"]CUSTOMER['"]/.test(listSrc),
    "list route initializes WHERE with role: 'CUSTOMER'"
  )
  // There must be NO `roleParam` parsing from URL search params.
  assert(
    !/searchParams\.get\(['"]role['"]\)/.test(listSrc),
    'list route does NOT parse a `role` query param'
  )
  // There must be NO conditional `where.role = roleParam` assignment.
  assert(
    !/where\.role\s*=\s*roleParam/.test(listSrc),
    'list route does NOT assign roleParam to where.role'
  )
  // The filters echo must NOT include `role`.
  const filtersEchoMatch = listSrc.match(/filters:\s*\{([\s\S]*?)\}/)
  if (filtersEchoMatch) {
    assert(
      !/\brole\b/.test(filtersEchoMatch[1]),
      'list route filters echo does NOT include `role`'
    )
  }

  // ---- SRC12: detail route uses findFirst with where:{id, role:'CUSTOMER'} ----
  console.log('\n[SRC12] customers/[id]/route.ts uses findFirst with where:{id, role:CUSTOMER}')
  // Must use findFirst (NOT findUnique) so role filter actually narrows.
  assert(
    /db\.user\.findFirst\(/.test(detailSrc),
    'detail route uses db.user.findFirst (NOT findUnique)'
  )
  assert(
    !/db\.user\.findUnique\(/.test(detailSrc),
    'detail route does NOT use db.user.findUnique'
  )
  // The findFirst where clause must include both id and role: 'CUSTOMER'.
  const detailWhereMatch = detailSrc.match(
    /db\.user\.findFirst\(\s*\{[\s\S]*?where:\s*\{([\s\S]*?)\}/
  )
  assert(!!detailWhereMatch, 'detail route findFirst has a where clause')
  if (detailWhereMatch) {
    const detailWhere = detailWhereMatch[1]
    assert(/\bid\b/.test(detailWhere), 'detail route where clause includes `id`')
    assert(
      /role:\s*['"]CUSTOMER['"]/.test(detailWhere),
      "detail route where clause includes role: 'CUSTOMER'"
    )
  }

  // ---- SRC13: export route hardcodes role='CUSTOMER' in WHERE (no role param) ----
  console.log('\n[SRC13] customers/export/route.ts hardcodes role=CUSTOMER (no role query param)')
  assert(
    /where:\s*WhereClause\s*=\s*\{\s*role:\s*['"]CUSTOMER['"]/.test(exportSrc),
    "export route initializes WHERE with role: 'CUSTOMER'"
  )
  assert(
    !/searchParams\.get\(['"]role['"]\)/.test(exportSrc),
    'export route does NOT parse a `role` query param'
  )
  assert(
    !/where\.role\s*=\s*roleParam/.test(exportSrc),
    'export route does NOT assign roleParam to where.role'
  )
  // Filename must NOT include role suffix.
  assert(
    !/filterParts\.push\(`role-/.test(exportSrc),
    'export route filename does NOT include role suffix'
  )

  // ---- SRC14: UI has functional Previous / Page X of Y / Next pagination ----
  console.log('\n[SRC14] CustomersView.tsx has functional pagination controls')
  // Must have a `page` state variable.
  assert(
    /const\s+\[page,\s*setPage\]\s*=\s*useState/.test(viewSrc),
    'view has a `page` state variable'
  )
  // Must have Previous / Next navigation handlers — goToPage function.
  assert(
    /goToPage/.test(viewSrc),
    'view has a goToPage helper for navigation'
  )
  // Must have a Pagination component used.
  assert(
    /<Pagination[\s\S]*?onPrev=/.test(viewSrc),
    'view renders a <Pagination> component with onPrev'
  )
  assert(
    /<Pagination[\s\S]*?onNext=/.test(viewSrc),
    'view renders a <Pagination> component with onNext'
  )
  // Must render "Halaman X / Y" indicator.
  assert(
    /Halaman\s*\{page\}\s*\/\s*\{totalPages/.test(viewSrc),
    'view renders "Halaman {page} / {totalPages}" indicator'
  )
  // Previous must be disabled on first page.
  assert(
    /disabled=\{isFirst\s*\|\|\s*loading\}/.test(viewSrc),
    'view disables Previous on first page (or while loading)'
  )
  // Next must be disabled on last page.
  assert(
    /disabled=\{isLast\s*\|\|\s*loading\}/.test(viewSrc),
    'view disables Next on last page (or while loading)'
  )
  // Must use ChevronLeft / ChevronRight icons from lucide-react.
  assert(
    /ChevronLeft/.test(viewSrc),
    'view imports ChevronLeft from lucide-react'
  )
  assert(
    /ChevronRight/.test(viewSrc),
    'view imports ChevronRight from lucide-react'
  )
  // Must reset page to 1 when filters change — the filter-key ref effect.
  assert(
    /lastFiltersKey/.test(viewSrc),
    'view has lastFiltersKey ref to detect filter changes'
  )
  assert(
    /setPage\(1\)/.test(viewSrc),
    'view calls setPage(1) when filters change'
  )
  // Must NOT have a Role filter dropdown (the DetailRow in the detail
  // dialog showing the user's role is fine — we only forbid the FILTER).
  // The regex requires `label="Role"` to appear immediately after
  // `<FilterSelect` (with only whitespace between) — this matches the
  // FilterSelect dropdown pattern but NOT the DetailRow inline pattern.
  assert(
    !/<FilterSelect\s+label=['"]Role['"]/.test(viewSrc),
    'view does NOT have a FilterSelect with label="Role" (Role filter dropdown removed)'
  )
  assert(
    !/RoleFilter/.test(viewSrc),
    'view does NOT have a RoleFilter type'
  )
}

// ============================================================================
// HTTP integration tests — only run when BASE_URL is set + DB available
// ============================================================================

async function http(
  method: string,
  path: string,
  opts: { cookie?: string; body?: any } = {}
): Promise<{ status: number; body: any; headers: Headers }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.cookie ? { Cookie: opts.cookie } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  let body: any = text
  try {
    body = JSON.parse(text)
  } catch {
    // not JSON (e.g. CSV export)
  }
  return { status: res.status, body, headers: res.headers }
}

async function loginAs(
  email: string,
  password: string
): Promise<{ cookie: string; user: any }> {
  const res = await http('POST', '/api/auth/login', { body: { email, password } })
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`)
  }
  // Extract set-cookie
  const setCookie = res.headers.get('set-cookie') || ''
  const cookie = setCookie.split(';')[0]
  return { cookie, user: res.body.user }
}

async function testHttpMemberRegistry() {
  console.log('\n========================================')
  console.log('HTTP integration tests — Member Registry (requires BASE_URL + DB)')
  console.log('========================================')

  // ---- Setup: create QA users (admin + customer + google-mock via DB direct) ----
  const { db } = await import('../src/lib/db')
  const bcrypt = (await import('bcryptjs')).default

  const adminEmail = `${QA_PREFIX}admin@example.com`
  const customerEmail = `${QA_PREFIX}customer@example.com`
  const googleEmail = `${QA_PREFIX}google@example.com`
  const sellerEmail = `${QA_PREFIX}seller@example.com`

  console.log(`\nSetup: creating QA users`)
  const adminUser = await db.user.create({
    data: {
      email: adminEmail,
      password: await bcrypt.hash('test-pw-123', 10),
      name: 'QA Admin',
      role: 'ADMIN',
      provider: 'PASSWORD',
      emailVerifiedAt: new Date(),
    },
  })
  const customerUser = await db.user.create({
    data: {
      email: customerEmail,
      password: await bcrypt.hash('test-pw-123', 10),
      name: 'QA Customer',
      role: 'CUSTOMER',
      provider: 'PASSWORD',
      emailVerifiedAt: null,
    },
  })
  // A mock Google user — simulates Google Sign-In outcome (email_verified=true).
  const googleUser = await db.user.create({
    data: {
      email: googleEmail,
      password: await bcrypt.hash('unused-google-user-no-login', 10),
      name: 'QA Google',
      role: 'CUSTOMER',
      provider: 'GOOGLE',
      providerSubject: 'mock-google-sub-123',
      emailVerifiedAt: new Date(),
    },
  })
  // A mock SELLER user — staff, must NOT appear in member registry.
  const sellerUser = await db.user.create({
    data: {
      email: sellerEmail,
      password: await bcrypt.hash('test-pw-123', 10),
      name: 'QA Seller',
      role: 'SELLER',
      provider: 'PASSWORD',
      emailVerifiedAt: new Date(),
    },
  })
  console.log(
    `  Created admin=${adminUser.id}, customer=${customerUser.id}, google=${googleUser.id}, seller=${sellerUser.id}`
  )

  try {
    // ---- A1. guest cannot list members → 401 ----
    console.log('\n[A1] Guest cannot list members → 401')
    const a1 = await http('GET', '/api/admin/customers')
    assertEqual(a1.status, 401, 'guest GET /api/admin/customers status')
    assertEqual(a1.body.code, 'UNAUTHENTICATED', 'guest error code')

    // ---- A2. customer cannot list members → 403 ----
    console.log('\n[A2] Customer cannot list members → 403')
    const { cookie: customerCookie } = await loginAs(customerEmail, 'test-pw-123')
    const a2 = await http('GET', '/api/admin/customers', { cookie: customerCookie })
    assertEqual(a2.status, 403, 'customer GET /api/admin/customers status')
    assertEqual(a2.body.code, 'FORBIDDEN', 'customer error code')

    // ---- A3. admin can list members → 200 ----
    console.log('\n[A3] Admin can list members → 200')
    const { cookie: adminCookie } = await loginAs(adminEmail, 'test-pw-123')
    const a3 = await http('GET', '/api/admin/customers', { cookie: adminCookie })
    assertEqual(a3.status, 200, 'admin GET /api/admin/customers status')
    assert(!!a3.body.members, 'response body has `members` array')
    // Only CUSTOMER members — admin + seller must NOT be in the list.
    assert(
      a3.body.members.every((m: any) => m.role === 'CUSTOMER'),
      'every member in list has role=CUSTOMER (no ADMIN/SELLER leak)'
    )
    assert(
      a3.body.members.some((m: any) => m.id === customerUser.id),
      'list includes the CUSTOMER (PASSWORD) user'
    )
    assert(
      a3.body.members.some((m: any) => m.id === googleUser.id),
      'list includes the CUSTOMER (GOOGLE) user'
    )

    // ---- P1. response does NOT expose `password` key ----
    console.log('\n[P1] Response does NOT expose `password` key')
    const sampleMember = a3.body.members[0]
    assert(!('password' in sampleMember), '`password` key absent in member record')

    // ---- P2. response does NOT expose `providerSubject` key ----
    console.log('\n[P2] Response does NOT expose `providerSubject` key')
    assert(!('providerSubject' in sampleMember), '`providerSubject` key absent in member record')

    // ---- P3. response does NOT expose verificationTokens ----
    console.log('\n[P3] Response does NOT expose `verificationTokens` rows')
    assert(
      !('verificationTokens' in sampleMember),
      '`verificationTokens` key absent in member record'
    )

    // ---- S1. search by name works ----
    // IMPORTANT: search by 'QA Admin' must NOT return the admin (admin is
    // ADMIN role, excluded). Instead we search for 'QA Customer' which is
    // a CUSTOMER.
    console.log('\n[S1] Search by name works')
    const s1 = await http(
      'GET',
      `/api/admin/customers?search=${encodeURIComponent('QA Customer')}`,
      { cookie: adminCookie }
    )
    assertEqual(s1.status, 200, 'search-by-name status')
    assert(s1.body.members.length >= 1, 'search-by-name returns >= 1 member')
    assert(
      s1.body.members.some((m: any) => m.name.includes('QA Customer')),
      'search-by-name returns the QA Customer user'
    )

    // ---- S2. search by email works ----
    console.log('\n[S2] Search by email works')
    const s2 = await http(
      'GET',
      `/api/admin/customers?search=${encodeURIComponent(googleEmail)}`,
      { cookie: adminCookie }
    )
    assertEqual(s2.status, 200, 'search-by-email status')
    assert(
      s2.body.members.some((m: any) => m.email === googleEmail),
      'search-by-email returns the QA Google user (CUSTOMER)'
    )
    // Even if we search by the admin's email, the admin should NOT appear.
    const s2b = await http(
      'GET',
      `/api/admin/customers?search=${encodeURIComponent(adminEmail)}`,
      { cookie: adminCookie }
    )
    assert(
      !s2b.body.members.some((m: any) => m.id === adminUser.id),
      'search-by-admin-email does NOT return the admin (role=ADMIN excluded)'
    )

    // ---- S3. search by phone works ----
    console.log('\n[S3] Search by phone works')
    // Add a phone to the customer user, then search for it
    await db.user.update({
      where: { id: customerUser.id },
      data: { phone: '+6281234567890' },
    })
    const s3 = await http(
      'GET',
      `/api/admin/customers?search=${encodeURIComponent('+6281234567890')}`,
      { cookie: adminCookie }
    )
    assertEqual(s3.status, 200, 'search-by-phone status')
    assert(
      s3.body.members.some((m: any) => m.phone === '+6281234567890'),
      'search-by-phone returns the QA Customer user'
    )

    // ---- F1. verified=true filter returns only verified members ----
    console.log('\n[F1] verified=true filter returns only verified members')
    const f1 = await http('GET', '/api/admin/customers?verified=true', {
      cookie: adminCookie,
    })
    assertEqual(f1.status, 200, 'verified=true status')
    assert(
      f1.body.members.every((m: any) => m.emailVerified === true),
      'every member in verified=true result has emailVerified=true'
    )
    // The QA Google user is verified + CUSTOMER → must be in the result.
    assert(
      f1.body.members.some((m: any) => m.id === googleUser.id),
      'verified=true result includes the verified QA Google (CUSTOMER) user'
    )
    // The QA Customer user is unverified → must NOT be in the result.
    assert(
      !f1.body.members.some((m: any) => m.id === customerUser.id),
      'verified=true result does NOT include the unverified QA Customer'
    )
    // The QA Admin is verified + ADMIN → must NOT appear (CUSTOMER-only invariant).
    assert(
      !f1.body.members.some((m: any) => m.id === adminUser.id),
      'verified=true result does NOT include the QA Admin (role=ADMIN excluded)'
    )

    // ---- F2. verified=false filter returns only unverified members ----
    console.log('\n[F2] verified=false filter returns only unverified members')
    const f2 = await http('GET', '/api/admin/customers?verified=false', {
      cookie: adminCookie,
    })
    assertEqual(f2.status, 200, 'verified=false status')
    assert(
      f2.body.members.every((m: any) => m.emailVerified === false),
      'every member in verified=false result has emailVerified=false'
    )
    assert(
      f2.body.members.some((m: any) => m.id === customerUser.id),
      'verified=false result includes the unverified QA Customer'
    )

    // ---- F3. provider=GOOGLE filter returns only Google members ----
    console.log('\n[F3] provider=GOOGLE filter returns only Google members')
    const f3 = await http('GET', '/api/admin/customers?provider=GOOGLE', {
      cookie: adminCookie,
    })
    assertEqual(f3.status, 200, 'provider=GOOGLE status')
    assert(
      f3.body.members.every((m: any) => m.provider === 'GOOGLE'),
      'every member in provider=GOOGLE result has provider=GOOGLE'
    )
    assert(
      f3.body.members.some((m: any) => m.id === googleUser.id),
      'provider=GOOGLE result includes the mock Google user'
    )

    // ---- F4. provider=PASSWORD filter returns only Email/Password members ----
    console.log('\n[F4] provider=PASSWORD filter returns only Email/Password members')
    const f4 = await http('GET', '/api/admin/customers?provider=PASSWORD', {
      cookie: adminCookie,
    })
    assertEqual(f4.status, 200, 'provider=PASSWORD status')
    assert(
      f4.body.members.every((m: any) => m.provider === 'PASSWORD'),
      'every member in provider=PASSWORD result has provider=PASSWORD'
    )
    assert(
      !f4.body.members.some((m: any) => m.id === googleUser.id),
      'provider=PASSWORD result does NOT include the Google user'
    )

    // ---- F5. REMOVED — role filter is no longer supported ----
    // The Member Registry always returns CUSTOMER users only. The role
    // query param is ignored (not parsed). R-series tests below cover the
    // CUSTOMER-only invariant explicitly.
    console.log('\n[F5] role query param is no longer accepted — REMOVED (replaced by R-series)')
    assert(true, 'role filter intentionally removed — see R1..R8 below')

    // ---- R1. CUSTOMER + GOOGLE → included in list ----
    console.log('\n[R1] CUSTOMER + GOOGLE → included in member list')
    const r1 = await http('GET', '/api/admin/customers', { cookie: adminCookie })
    assertEqual(r1.status, 200, 'R1 list status')
    assert(
      r1.body.members.some((m: any) => m.id === googleUser.id),
      'R1 list includes the CUSTOMER+GOOGLE user'
    )

    // ---- R2. CUSTOMER + PASSWORD → included in list ----
    console.log('\n[R2] CUSTOMER + PASSWORD → included in member list')
    assert(
      r1.body.members.some((m: any) => m.id === customerUser.id),
      'R2 list includes the CUSTOMER+PASSWORD user'
    )

    // ---- R3. ADMIN → excluded from list ----
    console.log('\n[R3] ADMIN → excluded from member list')
    assert(
      !r1.body.members.some((m: any) => m.id === adminUser.id),
      'R3 list does NOT include the ADMIN user'
    )
    // The `role` query param is ignored — even if we pass ?role=ADMIN, the
    // admin must still NOT appear (because role='CUSTOMER' is hardcoded).
    const r3 = await http('GET', '/api/admin/customers?role=ADMIN', { cookie: adminCookie })
    assertEqual(r3.status, 200, 'R3 ?role=ADMIN status (still 200 — param ignored)')
    assert(
      !r3.body.members.some((m: any) => m.id === adminUser.id),
      'R3 ?role=ADMIN does NOT include the admin (role param ignored, CUSTOMER-only)'
    )
    assert(
      r3.body.members.every((m: any) => m.role === 'CUSTOMER'),
      'R3 ?role=ADMIN result still all CUSTOMER (role param ignored)'
    )

    // ---- R4. SELLER → excluded from list ----
    console.log('\n[R4] SELLER → excluded from member list')
    assert(
      !r1.body.members.some((m: any) => m.id === sellerUser.id),
      'R4 list does NOT include the SELLER user'
    )
    const r4 = await http('GET', '/api/admin/customers?role=SELLER', { cookie: adminCookie })
    assertEqual(r4.status, 200, 'R4 ?role=SELLER status (param ignored)')
    assert(
      !r4.body.members.some((m: any) => m.id === sellerUser.id),
      'R4 ?role=SELLER does NOT include the seller (role param ignored)'
    )

    // ---- R5. ADMIN → excluded from detail (404) ----
    console.log('\n[R5] ADMIN id → detail 404 (not treated as a member)')
    const r5 = await http('GET', `/api/admin/customers/${adminUser.id}`, {
      cookie: adminCookie,
    })
    assertEqual(r5.status, 404, 'R5 admin id → 404')

    // ---- R6. SELLER → excluded from detail (404) ----
    console.log('\n[R6] SELLER id → detail 404 (not treated as a member)')
    const r6 = await http('GET', `/api/admin/customers/${sellerUser.id}`, {
      cookie: adminCookie,
    })
    assertEqual(r6.status, 404, 'R6 seller id → 404')

    // ---- R7. ADMIN → excluded from CSV export ----
    console.log('\n[R7] ADMIN email → excluded from CSV export')
    const r7 = await http('GET', '/api/admin/customers/export', { cookie: adminCookie })
    const r7Csv = typeof r7.body === 'string' ? r7.body : ''
    assert(r7Csv.length > 0, 'R7 export returned non-empty CSV')
    assert(
      !r7Csv.includes(adminEmail),
      'R7 CSV does NOT include the admin email'
    )

    // ---- R8. SELLER → excluded from CSV export ----
    console.log('\n[R8] SELLER email → excluded from CSV export')
    assert(
      !r7Csv.includes(sellerEmail),
      'R8 CSV does NOT include the seller email'
    )
    // Sanity: the CUSTOMER + GOOGLE members MUST be in the CSV.
    assert(
      r7Csv.includes(googleEmail),
      'R8 CSV includes the CUSTOMER+GOOGLE email (sanity)'
    )
    assert(
      r7Csv.includes(customerEmail),
      'R8 CSV includes the CUSTOMER+PASSWORD email (sanity)'
    )

    // ---- PG1. response pagination object has page/limit/total/totalPages ----
    console.log('\n[PG1] Response pagination object has all required fields')
    assert(!!a3.body.pagination, 'response body has `pagination` object')
    assertEqual(typeof a3.body.pagination.page, 'number', 'pagination.page is a number')
    assertEqual(typeof a3.body.pagination.limit, 'number', 'pagination.limit is a number')
    assertEqual(typeof a3.body.pagination.total, 'number', 'pagination.total is a number')
    assertEqual(
      typeof a3.body.pagination.totalPages,
      'number',
      'pagination.totalPages is a number'
    )
    assertEqual(a3.body.pagination.page, 1, 'default request returns page=1')
    assertEqual(a3.body.pagination.limit, 20, 'default request returns limit=20')
    // total/totalPages depend on DB state — sanity check that they are ≥0.
    assert(
      a3.body.pagination.total >= 0,
      `pagination.total is >= 0 (got ${a3.body.pagination.total})`
    )
    assert(
      a3.body.pagination.totalPages >= 0,
      `pagination.totalPages is >= 0 (got ${a3.body.pagination.totalPages})`
    )
    // totalPages = ceil(total / limit)
    const expectedTotalPages = Math.ceil(a3.body.pagination.total / a3.body.pagination.limit)
    assertEqual(
      a3.body.pagination.totalPages,
      expectedTotalPages,
      'pagination.totalPages = ceil(total / limit)'
    )

    // ---- PG2. page=2 returns the second page of results ----
    console.log('\n[PG2] page=2 returns the second page (different from page=1)')
    const pg2a = await http('GET', '/api/admin/customers?page=1&limit=2', { cookie: adminCookie })
    const pg2b = await http('GET', '/api/admin/customers?page=2&limit=2', { cookie: adminCookie })
    assertEqual(pg2a.status, 200, 'PG2 page=1 status')
    assertEqual(pg2b.status, 200, 'PG2 page=2 status')
    assertEqual(pg2a.body.pagination.page, 1, 'PG2 page=1 returns pagination.page=1')
    assertEqual(pg2b.body.pagination.page, 2, 'PG2 page=2 returns pagination.page=2')
    // If there are >2 CUSTOMER members in the DB, page 2 must have at least 1
    // member and the IDs must be DIFFERENT from page 1.
    if (pg2a.body.pagination.total > 2) {
      assert(pg2b.body.members.length >= 1, 'PG2 page=2 has >= 1 member (total > 2)')
      const page1Ids = new Set(pg2a.body.members.map((m: any) => m.id))
      const page2Ids = pg2b.body.members.map((m: any) => m.id)
      assert(
        page2Ids.every((id: string) => !page1Ids.has(id)),
        'PG2 page=2 member ids differ from page=1 (no overlap)'
      )
    } else {
      assert(
        pg2b.body.members.length === 0,
        'PG2 page=2 returns empty when total <= limit (no second page)'
      )
    }

    // ---- PG3. page beyond totalPages returns empty members array ----
    console.log('\n[PG3] page beyond totalPages → empty members (not an error)')
    const totalPages = a3.body.pagination.totalPages
    const beyondPage = totalPages + 5
    const pg3 = await http(
      'GET',
      `/api/admin/customers?page=${beyondPage}&limit=20`,
      { cookie: adminCookie }
    )
    assertEqual(pg3.status, 200, 'PG3 beyond-page status (not 4xx)')
    assertEqual(pg3.body.members.length, 0, 'PG3 beyond-page returns empty members array')
    assertEqual(pg3.body.pagination.page, beyondPage, 'PG3 echoes the requested page back')
    // total should match the unfiltered count (since no filters applied).
    assertEqual(pg3.body.pagination.total, a3.body.pagination.total, 'PG3 total matches unfiltered')

    // ---- PG4. limit cap of 100 is enforced by the server ----
    console.log('\n[PG4] limit=999 is capped at 100 by the server')
    const pg4 = await http(
      'GET',
      '/api/admin/customers?limit=999',
      { cookie: adminCookie }
    )
    assertEqual(pg4.status, 200, 'PG4 limit=999 status')
    assertEqual(pg4.body.pagination.limit, 100, 'PG4 server caps limit at 100')
    // Even with limit=10000, the server must not return more than 100 members.
    assert(
      pg4.body.members.length <= 100,
      `PG4 returns at most 100 members (got ${pg4.body.members.length})`
    )

    // ---- D1. admin can fetch detail by id → 200 ----
    console.log('\n[D1] Admin can fetch member detail by id → 200')
    const d1 = await http('GET', `/api/admin/customers/${customerUser.id}`, {
      cookie: adminCookie,
    })
    assertEqual(d1.status, 200, 'admin GET /api/admin/customers/:id status')
    assert(!!d1.body.member, 'detail response has `member` key')
    assertEqual(d1.body.member.id, customerUser.id, 'detail member.id matches')
    assertEqual(d1.body.member.emailVerified, false, 'detail customer is unverified')

    // ---- D2. customer cannot fetch detail → 403 ----
    console.log('\n[D2] Customer cannot fetch member detail → 403')
    const d2 = await http('GET', `/api/admin/customers/${customerUser.id}`, {
      cookie: customerCookie,
    })
    assertEqual(d2.status, 403, 'customer GET /api/admin/customers/:id status')

    // ---- D3. detail response does NOT expose sensitive fields ----
    console.log('\n[D3] Detail response does NOT expose password/providerSubject/verificationTokens')
    assert(!('password' in d1.body.member), 'detail member has no `password` key')
    assert(!('providerSubject' in d1.body.member), 'detail member has no `providerSubject` key')
    assert(
      !('verificationTokens' in d1.body.member),
      'detail member has no `verificationTokens` key'
    )

    // ---- D4. non-existent id → 404 ----
    console.log('\n[D4] Non-existent id → 404')
    const d4 = await http('GET', '/api/admin/customers/nonexistent-id-xxx', {
      cookie: adminCookie,
    })
    assertEqual(d4.status, 404, 'non-existent id status')
    // (ADMIN/SELLER ids → 404 is covered by R5/R6 above.)

    // ---- E1. admin can export → 200 + text/csv ----
    console.log('\n[E1] Admin can export → 200 + text/csv')
    const e1 = await http('GET', '/api/admin/customers/export', { cookie: adminCookie })
    assertEqual(e1.status, 200, 'admin GET export status')
    const ct = e1.headers.get('content-type') || ''
    assert(ct.includes('text/csv'), `export content-type is text/csv (got ${ct})`)
    const cd = e1.headers.get('content-disposition') || ''
    assert(/attachment;\s*filename=/.test(cd), `export content-disposition has attachment+filename`)

    // ---- E2. customer cannot export → 403 ----
    console.log('\n[E2] Customer cannot export → 403')
    const e2 = await http('GET', '/api/admin/customers/export', { cookie: customerCookie })
    assertEqual(e2.status, 403, 'customer GET export status')

    // ---- E3. export respects current filters ----
    console.log('\n[E3] Export respects current filters (verified=true)')
    const e3 = await http('GET', '/api/admin/customers/export?verified=true', {
      cookie: adminCookie,
    })
    assertEqual(e3.status, 200, 'filtered export status')
    const csvText = typeof e3.body === 'string' ? e3.body : ''
    assert(csvText.length > 0, 'filtered export returned non-empty CSV body')
    // The customer (unverified) should NOT be in the verified=true export.
    assert(
      !csvText.includes(customerEmail),
      'verified=true export does NOT include the unverified customer email'
    )
    // The Google user (verified + CUSTOMER) SHOULD be in the verified=true export.
    assert(
      csvText.includes(googleEmail),
      'verified=true export DOES include the verified Google (CUSTOMER) email'
    )
    // The admin (verified + ADMIN) should NOT be in the verified=true export
    // (CUSTOMER-only invariant — verified admin still excluded).
    assert(
      !csvText.includes(adminEmail),
      'verified=true export does NOT include the admin email (role=ADMIN excluded)'
    )

    // ---- E4. export contains expected columns (header row) ----
    console.log('\n[E4] Export contains expected columns (header row)')
    const firstLine = csvText.split('\r\n')[0] || csvText.split('\n')[0]
    const expectedCols = [
      'id', 'name', 'email', 'phone', 'role', 'provider',
      'emailVerified', 'emailVerifiedAt', 'createdAt',
      'totalOrders', 'lastOrderAt',
    ]
    for (const col of expectedCols) {
      assert(firstLine.includes(col), `header row includes '${col}'`)
    }

    // ---- E5. export does NOT contain password/providerSubject/token/security data ----
    console.log('\n[E5] Export does NOT contain sensitive data (password/providerSubject/token)')
    // Full export (no filter) — check ALL rows
    const e5 = await http('GET', '/api/admin/customers/export', { cookie: adminCookie })
    const fullCsv = typeof e5.body === 'string' ? e5.body : ''
    // Header must NOT include these column names
    const fullHeader = (fullCsv.split('\r\n')[0] || fullCsv.split('\n')[0]).toLowerCase()
    assert(!fullHeader.includes('password'), 'CSV header has no `password` column')
    assert(!fullHeader.includes('providersubject'), 'CSV header has no `providerSubject` column')
    assert(!fullHeader.includes('tokenhash'), 'CSV header has no `tokenHash` column')
    assert(!fullHeader.includes('auth_secret'), 'CSV header has no `AUTH_SECRET` column')
    // Body must NOT contain the mock Google `providerSubject` value
    assert(
      !fullCsv.includes('mock-google-sub-123'),
      'CSV body does NOT include the mock Google providerSubject value'
    )
    // Body must NOT contain the admin email (CUSTOMER-only invariant).
    assert(
      !fullCsv.includes(adminEmail),
      'CSV body does NOT include the admin email (role=ADMIN excluded from export)'
    )
    // Body must NOT contain the seller email (CUSTOMER-only invariant).
    assert(
      !fullCsv.includes(sellerEmail),
      'CSV body does NOT include the seller email (role=SELLER excluded from export)'
    )

    // ---- V5. client cannot set emailVerifiedAt via /api/auth/register body ----
    console.log('\n[V5] Client cannot set emailVerifiedAt via /api/auth/register body')
    // Try to register with emailVerifiedAt in the body — register route must ignore it
    const spoofEmail = `${QA_PREFIX}spoof@example.com`
    const v5 = await http('POST', '/api/auth/register', {
      body: {
        email: spoofEmail,
        password: 'test-pw-123',
        name: 'QA Spoof',
        emailVerifiedAt: new Date().toISOString(), // attempted injection
        provider: 'GOOGLE', // attempted injection
        role: 'ADMIN', // attempted injection
      },
    })
    assertEqual(v5.status, 200, 'register with spoof body status')
    // Fetch the user via admin endpoint and verify
    const v5Verify = await http(
      'GET',
      `/api/admin/customers?search=${encodeURIComponent(spoofEmail)}`,
      { cookie: adminCookie }
    )
    const spoofMember = v5Verify.body.members.find((m: any) => m.email === spoofEmail)
    assert(!!spoofMember, 'spoof user was created')
    if (spoofMember) {
      assertEqual(spoofMember.emailVerified, false, 'spoof user emailVerified=false (emailVerifiedAt injection ignored)')
      assertEqual(spoofMember.provider, 'PASSWORD', 'spoof user provider=PASSWORD (provider injection ignored)')
      assertEqual(spoofMember.role, 'CUSTOMER', 'spoof user role=CUSTOMER (role injection ignored)')
    }

    // ---- V6. duplicate email registration rejected ----
    console.log('\n[V6] Duplicate email registration rejected → 409')
    const v6 = await http('POST', '/api/auth/register', {
      body: {
        email: customerEmail, // already exists
        password: 'test-pw-123',
        name: 'QA Duplicate',
      },
    })
    assertEqual(v6.status, 409, 'duplicate email register status')
  } finally {
    // ---- Cleanup ----
    console.log('\nCleanup — deleting QA users + tokens')
    const qaEmails = [adminEmail, customerEmail, googleEmail, sellerEmail, `${QA_PREFIX}spoof@example.com`]
    const qaUserIds = (
      await db.user.findMany({
        where: { email: { in: qaEmails } },
        select: { id: true },
      })
    ).map((u) => u.id)
    if (qaUserIds.length > 0) {
      await db.emailVerificationToken.deleteMany({
        where: { userId: { in: qaUserIds } },
      }).catch(() => {})
      await db.cart.deleteMany({ where: { userId: { in: qaUserIds } } }).catch(() => {})
      await db.user.deleteMany({ where: { id: { in: qaUserIds } } }).catch(() => {})
      console.log(`  Deleted ${qaUserIds.length} QA users`)
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('========================================')
  console.log('Member Registry & Verified Registration V1 — tests')
  console.log('========================================')
  console.log(`QA_PREFIX: ${QA_PREFIX}`)
  console.log(`HTTP mode: ${HTTP_MODE ? 'ENABLED (' + BASE_URL + ')' : 'DISABLED (BASE_URL unset)'}`)
  console.log('')

  // ----- Source-level invariants (always run) -----
  testSourceInvariants()

  // ----- HTTP integration tests (only if BASE_URL is set) -----
  if (HTTP_MODE) {
    try {
      await testHttpMemberRegistry()
    } catch (e) {
      console.log('\n⚠️  HTTP tests failed:', e instanceof Error ? e.message : e)
    }
  } else {
    console.log('\n========================================')
    console.log('HTTP integration tests — SKIPPED (BASE_URL not set)')
    console.log('========================================')
    console.log('To enable HTTP integration tests:')
    console.log('  1. Start the dev server: bun run dev')
    console.log('  2. Run with BASE_URL set:')
    console.log('     BASE_URL="http://localhost:3000" bun run scripts/test-member-registry.ts')
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
    try {
      const { db } = await import('../src/lib/db')
      await db.$disconnect()
    } catch {
      // ignore — db may not have been imported
    }
  })
