/**
 * QA Test 5 — Legacy session compatibility.
 *
 * Proves the intended V2 migration policy for legacy (pre-V2) session
 * cookies that do NOT carry a `sessionVersion` claim.
 *
 * The migration policy (encoded in src/lib/auth.ts `getCurrentUser`):
 *   - A legacy cookie (no sessionVersion field) is treated as
 *     sessionVersion = 0.
 *   - The DB's `User.sessionVersion` defaults to 0 (existing rows
 *     created before V2 are backwards-compatible).
 *   - So a legacy cookie presented against a user with DB
 *     sessionVersion=0 → MATCH → session is valid.
 *   - After a password reset, the DB's sessionVersion is bumped to 1.
 *     The SAME legacy cookie (still no sessionVersion field, treated
 *     as 0) is presented → MISMATCH (0 != 1) → session is INVALID.
 *
 * This test uses the SAME `verify()` and `getCurrentUser()` code paths
 * that production uses, by directly invoking the session-signing
 * helpers from src/lib/auth.ts.
 *
 * Steps:
 *   1. Sign a "legacy" session cookie WITHOUT a sessionVersion field
 *      (simulating a pre-V2 cookie).
 *   2. Confirm the user's DB sessionVersion is 0.
 *   3. Verify the legacy cookie authenticates successfully (treated as v0).
 *   4. Perform a password reset (which bumps DB sessionVersion to 1).
 *   5. Verify the SAME legacy cookie now FAILS to authenticate
 *      (0 != 1 → session invalid).
 *   6. Verify a NEW cookie signed with sessionVersion=1 authenticates
 *      correctly against the bumped DB state.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
// QA-only file: uses dynamic require() to install the next/headers monkey-patch
// BEFORE src/lib/auth is loaded. The eslint rule forbidding require() does not
// apply to this QA script — it's a deliberate pattern, documented inline.

import { PrismaClient } from '@prisma/client'

// ---- MOCK next/headers.cookies() BEFORE loading src/lib/auth ----
// `getCurrentUser()` reads the session cookie via `cookies()` from
// `next/headers`, which only works inside a Next.js request scope.
// For this QA script (standalone `bun run`), we monkey-patch the
// `next/headers` module's `cookies` export to inject an in-memory
// cookie store. This MUST happen BEFORE any `import` of `src/lib/auth`,
// because ES module hoisting evaluates all imports first, and auth.ts
// captures the `cookies` reference at module-load time.
//
// To guarantee ordering, we use dynamic `require()` for everything that
// transitively imports `next/headers` — that way the monkey-patch runs
// before those modules are evaluated.
const _cookieJar = new Map<string, string>()
;(require('next/headers') as any).cookies = async () => ({
  get: (name: string) => {
    const v = _cookieJar.get(name)
    return v === undefined ? undefined : { name, value: v }
  },
  set: (name: string, value: string) => {
    _cookieJar.set(name, value)
  },
  delete: (name: string) => {
    _cookieJar.delete(name)
  },
})

// Now load auth.ts and friends — they will see our patched `cookies`.
const { createSession, getCurrentUser, hashPassword } = require('../src/lib/auth')
const { issueOtp, consumeOtp } = require('../src/lib/otp')
const { issueResetGrant, hashResetGrant } = require('../src/lib/password-reset')

const prisma = new PrismaClient()

const SESSION_COOKIE = 'anima_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

const DEV_FALLBACK_SECRET = 'anima-companion-dev-secret-change-in-prod'
function getSecret(): string {
  const env = process.env.AUTH_SECRET
  if (env) return env
  return DEV_FALLBACK_SECRET
}

async function signLegacyCookie(payload: object): Promise<string> {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return `${body}.${Buffer.from(sig).toString('base64url')}`
}

async function setLegacyCookie(token: string) {
  const cookieStore = await (require('next/headers') as any).cookies()
  cookieStore.set(SESSION_COOKIE, token)
}

async function clearCookie() {
  const cookieStore = await (require('next/headers') as any).cookies()
  cookieStore.delete(SESSION_COOKIE)
}

async function main() {
  console.log('=== QA Test 5: Legacy session compatibility ===')

  const user = await prisma.user.findUnique({
    where: { email: 'qa-v2-legacy@example.com' },
    select: { id: true, email: true, name: true, role: true, password: true, sessionVersion: true },
  })
  if (!user) throw new Error('QA user qa-v2-legacy@example.com not found — run seed-qa first')

  // Reset to known state
  const oldHash = await hashPassword('qa-old-password-003')
  await prisma.user.update({
    where: { id: user.id },
    data: { password: oldHash, sessionVersion: 0 },
    select: { id: true },
  })
  await prisma.otpCode.deleteMany({ where: { userId: user.id } })
  await prisma.passwordResetGrant.deleteMany({ where: { userId: user.id } })

  // ---- Step 1: Sign a LEGACY cookie WITHOUT sessionVersion ----
  console.log('\n--- Step 1: Sign a legacy cookie (no sessionVersion field) ---')
  const legacyToken = await signLegacyCookie({
    userId: user.id,
    email: user.email,
    role: user.role,
    // NOTE: no sessionVersion field — simulates a pre-V2 cookie.
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  })
  await setLegacyCookie(legacyToken)
  console.log('  ✓ Legacy cookie set (no sessionVersion claim).')

  // ---- Step 2: Confirm DB sessionVersion = 0 ----
  console.log('\n--- Step 2: DB sessionVersion = 0 ---')
  const before = await prisma.user.findUnique({
    where: { id: user.id },
    select: { sessionVersion: true },
  })
  console.log(`  User.sessionVersion = ${before?.sessionVersion}  (expected 0)`)
  if (before?.sessionVersion !== 0) throw new Error('Expected sessionVersion=0')

  // ---- Step 3: Legacy cookie authenticates (treated as v0) ----
  console.log('\n--- Step 3: Legacy cookie authenticates against DB v0 ---')
  const sessionBefore = await getCurrentUser()
  const step3Pass = sessionBefore !== null && sessionBefore.id === user.id
  console.log(`  getCurrentUser() returned: ${sessionBefore ? `user.id=${sessionBefore.id}` : 'null'}`)
  console.log(`  Step 3 ${step3Pass ? 'PASS ✅' : 'FAIL ❌'}`)
  if (!step3Pass) throw new Error('Legacy cookie should authenticate against DB v0')

  // ---- Step 4: Perform password reset (bumps DB sessionVersion 0→1) ----
  console.log('\n--- Step 4: Password reset (bumps DB sessionVersion 0→1) ---')
  const otpIssued = await issueOtp({ userId: user.id, purpose: 'PASSWORD_RESET' })
  const otpRes = await consumeOtp({
    userId: user.id,
    purpose: 'PASSWORD_RESET',
    code: otpIssued.code,
  })
  if (otpRes.result !== 'OK') throw new Error(`Expected OK, got ${otpRes.result}`)
  const grant = await issueResetGrant(user.id)
  const grantHash = hashResetGrant(grant.grant)
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    const row = await tx.passwordResetGrant.findUnique({
      where: { grantHash },
      select: { id: true, userId: true, consumedAt: true, expiresAt: true },
    })
    if (!row || row.consumedAt || row.expiresAt <= now) throw new Error('Grant invalid')
    const claim = await tx.passwordResetGrant.updateMany({
      where: { id: row.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    })
    if (claim.count !== 1) throw new Error('Grant race lost')
    const newHash = await hashPassword('qa-new-password-003-CHANGED')
    await tx.user.update({
      where: { id: row.userId },
      data: { password: newHash, sessionVersion: { increment: 1 } },
      select: { id: true },
    })
    await tx.otpCode.updateMany({
      where: { userId: row.userId, consumedAt: null },
      data: { consumedAt: now },
    })
  })
  const after = await prisma.user.findUnique({
    where: { id: user.id },
    select: { sessionVersion: true },
  })
  console.log(`  User.sessionVersion = ${after?.sessionVersion}  (expected 1)`)
  if (after?.sessionVersion !== 1) throw new Error('Expected sessionVersion=1 after reset')

  // ---- Step 5: SAME legacy cookie now FAILS (0 != 1) ----
  console.log('\n--- Step 5: Same legacy cookie now FAILS to authenticate (0 != 1) ---')
  // The cookie is already set from Step 1 — we don't re-set it.
  const sessionAfter = await getCurrentUser()
  const step5Pass = sessionAfter === null
  console.log(`  getCurrentUser() returned: ${sessionAfter === null ? 'null (unauthenticated)' : 'NON-null (LEAK!)'}`)
  console.log(`  Step 5 ${step5Pass ? 'PASS ✅' : 'FAIL ❌'}`)
  if (!step5Pass) throw new Error('Legacy cookie should be INVALID after sessionVersion bump')

  // ---- Step 6: A NEW cookie signed with sessionVersion=1 authenticates ----
  console.log('\n--- Step 6: New cookie signed with sessionVersion=1 authenticates ---')
  await clearCookie()
  await createSession({
    id: user.id,
    email: user.email,
    role: user.role,
    sessionVersion: 1, // matches DB
  })
  const sessionNew = await getCurrentUser()
  const step6Pass = sessionNew !== null && sessionNew.id === user.id
  console.log(`  getCurrentUser() returned: ${sessionNew ? `user.id=${sessionNew.id}` : 'null'}`)
  console.log(`  Step 6 ${step6Pass ? 'PASS ✅' : 'FAIL ❌'}`)
  if (!step6Pass) throw new Error('New cookie with matching sessionVersion should authenticate')

  console.log('\n--- SUMMARY ---')
  console.log(`Step 1: Sign legacy cookie (no sessionVersion)         ✅`)
  console.log(`Step 2: DB sessionVersion = 0                          ✅`)
  console.log(`Step 3: Legacy cookie authenticates against DB v0      ✅`)
  console.log(`Step 4: Password reset → DB sessionVersion = 1         ✅`)
  console.log(`Step 5: Legacy cookie now REJECTED (0 != 1)            ✅`)
  console.log(`Step 6: New cookie (v1) authenticates against DB v1    ✅`)
  console.log(`\nOVERALL: PASS ✅`)
  console.log('')
  console.log('Migration policy verified: pre-V2 session cookies (no sessionVersion')
  console.log('claim) continue to work against DB v0, but are immediately invalidated')
  console.log('when a password reset bumps the DB sessionVersion. The user must')
  console.log('re-authenticate with the new password, which issues a v1 cookie.')
}

main()
  .catch((e) => {
    console.error('QA Test 5 FAILED:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
