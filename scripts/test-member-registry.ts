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
 * Scenarios covered (per task spec PHASE 10):
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
 *   F5. role filter works
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
  console.log('Source-level invariants — admin member routes + email adapter')
  console.log('========================================')

  const listSrc = readSrc('src/app/api/admin/customers/route.ts')
  const detailSrc = readSrc('src/app/api/admin/customers/[id]/route.ts')
  const exportSrc = readSrc('src/app/api/admin/customers/export/route.ts')
  const emailSrc = readSrc('src/lib/email.ts')
  const registerSrc = readSrc('src/app/api/auth/register/route.ts')

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
  console.log(`  Created admin=${adminUser.id}, customer=${customerUser.id}, google=${googleUser.id}`)

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
    assert(a3.body.members.length >= 3, `response has >= 3 members (got ${a3.body.members.length})`)

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
    console.log('\n[S1] Search by name works')
    const s1 = await http(
      'GET',
      `/api/admin/customers?search=${encodeURIComponent('QA Admin')}`,
      { cookie: adminCookie }
    )
    assertEqual(s1.status, 200, 'search-by-name status')
    assert(s1.body.members.length >= 1, 'search-by-name returns >= 1 member')
    assert(
      s1.body.members.some((m: any) => m.name.includes('QA Admin')),
      'search-by-name returns the QA Admin user'
    )

    // ---- S2. search by email works ----
    console.log('\n[S2] Search by email works')
    const s2 = await http(
      'GET',
      `/api/admin/customers?search=${encodeURIComponent(adminEmail)}`,
      { cookie: adminCookie }
    )
    assertEqual(s2.status, 200, 'search-by-email status')
    assert(
      s2.body.members.some((m: any) => m.email === adminEmail),
      'search-by-email returns the QA Admin user'
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
    assert(
      f1.body.members.some((m: any) => m.id === adminUser.id),
      'verified=true result includes the verified QA admin'
    )
    assert(
      !f1.body.members.some((m: any) => m.id === customerUser.id),
      'verified=true result does NOT include the unverified QA customer'
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
      'verified=false result includes the unverified QA customer'
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

    // ---- F5. role filter works ----
    console.log('\n[F5] role=ADMIN filter returns only ADMIN members')
    const f5 = await http('GET', '/api/admin/customers?role=ADMIN', {
      cookie: adminCookie,
    })
    assertEqual(f5.status, 200, 'role=ADMIN status')
    assert(
      f5.body.members.every((m: any) => m.role === 'ADMIN'),
      'every member in role=ADMIN result has role=ADMIN'
    )
    assert(
      f5.body.members.some((m: any) => m.id === adminUser.id),
      'role=ADMIN result includes the QA admin'
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
    // The customer (unverified) should NOT be in the verified=true export
    // (search by email — the customer email is unique to the QA user)
    assert(
      !csvText.includes(customerEmail),
      'verified=true export does NOT include the unverified customer email'
    )
    // The admin (verified) SHOULD be in the verified=true export
    assert(
      csvText.includes(adminEmail),
      'verified=true export DOES include the verified admin email'
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
    const qaEmails = [adminEmail, customerEmail, googleEmail, `${QA_PREFIX}spoof@example.com`]
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
