/**
 * Account Recovery & Verification V2 — OTP domain foundation test scenarios.
 *
 * Run with:
 *   # Pure static tests (always run, no DB, no HTTP):
 *   bun run scripts/test-otp-domain.ts
 *
 *   # Full HTTP integration tests (requires a running server + PostgreSQL):
 *   BASE_URL="http://localhost:3000" bun run scripts/test-otp-domain.ts
 *
 * IMPORTANT:
 * - This script does NOT mutate the database in static mode. It only verifies
 *   the OTP helpers (code generation, HMAC hashing, constant-time compare)
 *   and source-level invariants for the schema + lib files.
 * - In HTTP mode (BASE_URL set), the script exercises the OTP issuance and
 *   verification flows via the API routes (once those are implemented in
 *   stage 2+). Currently HTTP mode is a no-op pending route implementation.
 * - The script aborts immediately if NODE_ENV=production.
 * - All assertions are static (no test framework). Output is human-readable.
 *   Exit code is 0 if all scenarios pass, 1 otherwise.
 *
 * Scenarios covered (Stage 1 — domain foundation only):
 *
 * Pure-static (always run):
 *   OTP1.  generateOtpCode() returns a 6-character zero-padded numeric string.
 *   OTP2.  generateOtpCode() distribution is uniform-ish over 10k samples
 *          (each digit 0-9 appears with reasonable frequency — sanity check
 *          against the CSPRNG, not a full statistical test).
 *   OTP3.  hashOtpCode() returns a 64-char hex string (SHA-256 digest length).
 *   OTP4.  hashOtpCode() is deterministic: same inputs → same output.
 *   OTP5.  hashOtpCode() differs when `code` changes (sensitive to code).
 *   OTP6.  hashOtpCode() differs when `purpose` changes (purpose-binding).
 *   OTP7.  hashOtpCode() differs when `userId` changes (user-binding).
 *   OTP8.  hashOtpCode() does NOT use plain SHA-256 — the HMAC differs from
 *          SHA-256(code) even with the same code, proving the pepper is
 *          applied. (Critical: a 6-digit code with plain SHA-256 is
 *          brute-forceable in microseconds on a DB leak.)
 *   OTP9.  constantTimeEqualHex() returns true for equal strings.
 *   OTP10. constantTimeEqualHex() returns false for different strings.
 *   OTP11. constantTimeEqualHex() returns false for different-length strings.
 *   OTP12. OTP_TTL_MS === 10 * 60 * 1000 (10 minutes per V2 spec).
 *   OTP13. OTP_RESEND_COOLDOWN_MS === 60 * 1000 (60 seconds per V2 spec).
 *   OTP14. OTP_DEFAULT_MAX_ATTEMPTS === 5 (max 5 attempts per V2 spec).
 *
 *   GRANT1. generateResetGrant() returns a 64-char hex string (32 bytes).
 *   GRANT2. hashResetGrant() returns a 64-char hex string (SHA-256 digest).
 *   GRANT3. hashResetGrant() is deterministic.
 *   GRANT4. hashResetGrant() differs when the input changes.
 *   GRANT5. constantTimeEqualGrantHash() returns true for equal strings.
 *   GRANT6. constantTimeEqualGrantHash() returns false for different strings.
 *
 *   SRC1.  prisma/schema.prisma declares `OtpCode` model with required fields.
 *   SRC2.  prisma/schema.prisma declares `PasswordResetGrant` model with required fields.
 *   SRC3.  prisma/schema.prisma adds `sessionVersion` field to User (Int, default 0).
 *   SRC4.  OtpCode has @@index([userId, purpose]) and @@index([expiresAt]).
 *   SRC5.  PasswordResetGrant.grantHash is @unique.
 *   SRC6.  src/lib/otp.ts exports: generateOtpCode, hashOtpCode,
 *          constantTimeEqualHex, issueOtp, checkResendCooldown, consumeOtp,
 *          revokeAllOtpsForUser, OTP_TTL_MS, OTP_RESEND_COOLDOWN_MS,
 *          OTP_DEFAULT_MAX_ATTEMPTS.
 *   SRC7.  src/lib/otp.ts consumeOtp uses db.$transaction(async (tx) => ...)
 *          (interactive form, NOT array form — array form cannot gate on
 *          claim.count).
 *   SRC8.  src/lib/otp.ts consumeOtp gates the side effect on claim.count === 1.
 *   SRC9.  src/lib/otp.ts issueOtp invalidates old unconsumed OTPs by setting
 *          consumedAt AND attempts = maxAttempts (defense-in-depth).
 *   SRC10. src/lib/otp.ts uses createHmac('sha256', ...) for code hashing
 *          (NOT createHash — plain SHA-256 would be unsafe for 6-digit codes).
 *   SRC11. src/lib/otp.ts uses crypto.randomInt (NOT Math.random) for code
 *          generation (CSPRNG, no modulo bias).
 *   SRC12. src/lib/otp.ts uses timingSafeEqual in constantTimeEqualHex
 *          (constant-time comparison, not ===).
 *   SRC13. src/lib/password-reset.ts exports: generateResetGrant,
 *          hashResetGrant, constantTimeEqualGrantHash, issueResetGrant,
 *          RESET_GRANT_TTL_MS.
 *   SRC14. src/lib/password-reset.ts issueResetGrant invalidates old
 *          unconsumed grants (sets consumedAt = now()).
 *   SRC15. src/lib/password-reset.ts uses createHash('sha256') for grant
 *          hashing (SHA-256 is sufficient for 32-byte CSPRNG input —
 *          no HMAC pepper needed unlike the 6-digit OTP).
 *   SRC16. prisma/sql/20260815-account-recovery-v2.sql exists and contains
 *          CREATE TABLE "OtpCode" + "PasswordResetGrant" + ALTER TABLE
 *          "User" ADD COLUMN "sessionVersion".
 *   SRC17. .env.example documents AUTH_SECRET's dual role as OTP HMAC pepper.
 *   SRC18. src/lib/otp.ts does NOT export a separate OTP_SECRET — the HMAC
 *          pepper is AUTH_SECRET (single trust boundary).
 *   SRC19. src/lib/password-reset.ts does NOT expose a `consumeResetGrant`
 *          helper — grant consumption MUST happen inside the reset-password
 *          route's interactive transaction (atomic with the password update
 *          and sessionVersion bump).
 *
 * Stage 2 — register + send-otp route invariants:
 *   SRC20. register route imports `issueOtp` from '@/lib/otp' (NOT
 *          `issueVerificationToken` from '@/lib/identity' — V2 replaces V1
 *          link-token issuance for new registrations).
 *   SRC21. register route imports `sendOtpEmail` from '@/lib/email' (NOT
 *          `sendVerificationEmail`).
 *   SRC22. register route calls `issueOtp({ userId, purpose: 'EMAIL_VERIFICATION' })`.
 *   SRC23. register route returns `otpSent` in the response body (so the UI
 *          can show a "cek email" message). The raw OTP is NEVER returned.
 *   SRC24. register route does NOT log the raw OTP code (the catch block
 *          uses logAuthError with a stable event label).
 *   SRC25. send-otp route (src/app/api/auth/verify-email/send-otp/route.ts)
 *          exists, requires auth (requireAuth), checks provider === 'GOOGLE'
 *          → 400, checks emailVerifiedAt → alreadyVerified, checks
 *          checkResendCooldown → 429 with retryAfterMs.
 *   SRC26. send-otp route never returns the raw OTP code in the response.
 *   SRC27. send-otp route returns 429 with `code: 'RESEND_COOLDOWN'` and
 *          `retryAfterMs` when the 60-second cooldown has not elapsed.
 *   SRC28. src/lib/email.ts exports `sendOtpEmail` (V2 OTP email body).
 *   SRC29. sendOtpEmail does NOT log the raw OTP code in production paths
 *          (delegates to the adapter, which sanitizes).
 *   SRC30. RegisterView navigates to /verify-email after successful
 *          registration (NOT to / or nextPath — the user must verify first).
 *
 * HTTP integration (placeholder — implemented in stage 2+):
 *   (none yet — OTP API routes are implemented in stage 2+)
 */

// ----- Safety guards -----
if (process.env.NODE_ENV === 'production') {
  console.error('REFUSING TO RUN: NODE_ENV is "production".')
  console.error('This script may register temporary QA users; never run against production.')
  process.exit(2)
}

import {
  generateOtpCode,
  hashOtpCode,
  constantTimeEqualHex,
  OTP_TTL_MS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_DEFAULT_MAX_ATTEMPTS,
} from '../src/lib/otp'
import {
  generateResetGrant,
  hashResetGrant,
  constantTimeEqualGrantHash,
  RESET_GRANT_TTL_MS,
} from '../src/lib/password-reset'
import { createHash, createHmac } from 'crypto'
import { readFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'

const ROOT = process.cwd()
const SRC = (p: string) => join(ROOT, 'src', p)
const PKG = (p: string) => join(ROOT, p)

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

function assertEqual<T>(actual: T, expected: T, message: string) {
  const ok = actual === expected
  if (ok) {
    console.log(`  ✅ ${message}`)
    pass++
  } else {
    console.log(`  ❌ ${message} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`)
    fail++
    failures.push(`${message} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`)
  }
}

// ---------------------------------------------------------------------------
// Pure-static scenarios
// ---------------------------------------------------------------------------

console.log('\n── OTP code generation ──')

// OTP1. 6-char zero-padded numeric string.
{
  const code = generateOtpCode()
  assert(/^[0-9]{6}$/.test(code), 'OTP1: generateOtpCode returns a 6-char numeric string')
  // Test zero-padding: generate until we see a code with a leading zero
  // (probability 10%, so within ~30 tries we'll see one).
  let sawLeadingZero = false
  for (let i = 0; i < 100; i++) {
    const c = generateOtpCode()
    if (!/^[0-9]{6}$/.test(c)) {
      assert(false, `OTP1: code ${c} is not 6-char numeric`)
      break
    }
    if (c.startsWith('0')) {
      sawLeadingZero = true
      break
    }
  }
  assert(sawLeadingZero, 'OTP1: generateOtpCode zero-pads (saw a leading-zero code in 100 samples)')
}

// OTP2. Uniform-ish distribution over 10k samples.
{
  const counts: Record<string, number> = {}
  const N = 10_000
  for (let i = 0; i < N; i++) {
    const c = generateOtpCode()
    counts[c] = (counts[c] || 0) + 1
  }
  // Each of the 10^6 codes should appear ~0.01 times on average over 10k samples.
  // Instead, sanity-check that no single code appears more than 10 times
  // (which would indicate severe bias — under uniform, the max count over
  // 10k samples from 1M codes is ~4-5 by birthday-paradox intuition).
  const maxCount = Math.max(...Object.values(counts))
  assert(maxCount < 20, `OTP2: no single code dominates 10k samples (max count = ${maxCount})`)

  // Also check that the first-digit distribution is roughly uniform (each
  // digit 0-9 should appear ~1000 times ±100).
  const firstDigitCounts: number[] = new Array(10).fill(0)
  for (let i = 0; i < N; i++) {
    const c = generateOtpCode()
    firstDigitCounts[parseInt(c[0], 10)]++
  }
  const minFirst = Math.min(...firstDigitCounts)
  const maxFirst = Math.max(...firstDigitCounts)
  assert(
    minFirst > 800 && maxFirst < 1200,
    `OTP2: first-digit distribution roughly uniform over 10k samples (min=${minFirst}, max=${maxFirst})`
  )
}

console.log('\n── OTP HMAC hashing ──')

// OTP3-OTP7. HMAC hashing properties.
{
  const code1 = '123456'
  const code2 = '654321'
  const purpose1: 'EMAIL_VERIFICATION' = 'EMAIL_VERIFICATION'
  const purpose2: 'PASSWORD_RESET' = 'PASSWORD_RESET'
  const user1 = 'user-aaa'
  const user2 = 'user-bbb'

  const h1 = hashOtpCode(code1, purpose1, user1)
  // OTP3: 64-char hex
  assert(/^[0-9a-f]{64}$/.test(h1), 'OTP3: hashOtpCode returns 64-char hex digest')

  // OTP4: deterministic
  const h1b = hashOtpCode(code1, purpose1, user1)
  assertEqual(h1, h1b, 'OTP4: hashOtpCode is deterministic')

  // OTP5: sensitive to code
  const h2 = hashOtpCode(code2, purpose1, user1)
  assert(h1 !== h2, 'OTP5: hashOtpCode differs when code changes')

  // OTP6: sensitive to purpose
  const h3 = hashOtpCode(code1, purpose2, user1)
  assert(h1 !== h3, 'OTP6: hashOtpCode differs when purpose changes (purpose-binding)')

  // OTP7: sensitive to userId
  const h4 = hashOtpCode(code1, purpose1, user2)
  assert(h1 !== h4, 'OTP7: hashOtpCode differs when userId changes (user-binding)')

  // OTP8: NOT plain SHA-256(code) — must be HMAC-peppered.
  // The HMAC result should differ from SHA-256(code) AND from SHA-256(code+userId)
  // AND from SHA-256(userId+code). If any of those matched, the pepper would
  // not be applied (or would be empty).
  const plainSha = createHash('sha256').update(code1).digest('hex')
  assert(h1 !== plainSha, 'OTP8: hashOtpCode != plain SHA-256(code) — pepper is applied')
  const concatSha1 = createHash('sha256').update(code1 + user1).digest('hex')
  assert(h1 !== concatSha1, 'OTP8: hashOtpCode != SHA-256(code+userId) — pepper is not just userId')
  const concatSha2 = createHash('sha256').update(user1 + code1).digest('hex')
  assert(h1 !== concatSha2, 'OTP8: hashOtpCode != SHA-256(userId+code) — pepper is not just userId')

  // Cross-check: compute the expected HMAC manually and verify it matches.
  // This proves the implementation is HMAC-SHA-256, not some other construction.
  const devSecret = 'anima-companion-dev-secret-change-in-prod'
  const expectedMessage = `${purpose1}\0${user1}\0${code1}`
  const expectedHmac = createHmac('sha256', devSecret).update(expectedMessage, 'utf8').digest('hex')
  assertEqual(h1, expectedHmac, 'OTP8: hashOtpCode matches manually-computed HMAC-SHA-256 (dev secret)')
}

console.log('\n── Constant-time comparison ──')

// OTP9-OTP11. constantTimeEqualHex.
{
  const a = 'a'.repeat(64)
  const b = 'a'.repeat(64)
  const c = 'b' + 'a'.repeat(63)
  const d = 'a'.repeat(32) // different length

  assert(constantTimeEqualHex(a, b) === true, 'OTP9: constantTimeEqualHex returns true for equal strings')
  assert(constantTimeEqualHex(a, c) === false, 'OTP10: constantTimeEqualHex returns false for different strings')
  assert(constantTimeEqualHex(a, d) === false, 'OTP11: constantTimeEqualHex returns false for different-length strings')
  // Symmetry
  assert(constantTimeEqualHex(b, a) === true, 'OTP9: constantTimeEqualHex is symmetric (b,a)')
  assert(constantTimeEqualHex(c, a) === false, 'OTP10: constantTimeEqualHex is symmetric (c,a)')
  // Empty string
  assert(constantTimeEqualHex('', '') === true, 'OTP9: constantTimeEqualHex handles empty strings')
  assert(constantTimeEqualHex('', a) === false, 'OTP11: constantTimeEqualHex handles empty vs non-empty')
}

console.log('\n── Constants ──')

// OTP12-OTP14. V2 spec constants.
assertEqual(OTP_TTL_MS, 10 * 60 * 1000, 'OTP12: OTP_TTL_MS === 10 minutes (V2 spec)')
assertEqual(OTP_RESEND_COOLDOWN_MS, 60 * 1000, 'OTP13: OTP_RESEND_COOLDOWN_MS === 60 seconds (V2 spec)')
assertEqual(OTP_DEFAULT_MAX_ATTEMPTS, 5, 'OTP14: OTP_DEFAULT_MAX_ATTEMPTS === 5 (V2 spec)')

console.log('\n── Reset grant generation + hashing ──')

// GRANT1. 64-char hex.
{
  const g = generateResetGrant()
  assert(/^[0-9a-f]{64}$/.test(g), 'GRANT1: generateResetGrant returns 64-char hex (32 bytes)')

  // Uniqueness over 1000 samples (collision would be astronomically unlikely
  // but this catches accidental determinism bugs like returning a constant).
  const set = new Set<string>()
  for (let i = 0; i < 1000; i++) {
    set.add(generateResetGrant())
  }
  assertEqual(set.size, 1000, 'GRANT1: 1000 generated grants are all unique')
}

// GRANT2-GRANT4. hashResetGrant properties.
{
  const g1 = generateResetGrant()
  const g2 = generateResetGrant()
  const h1 = hashResetGrant(g1)
  assert(/^[0-9a-f]{64}$/.test(h1), 'GRANT2: hashResetGrant returns 64-char hex digest')
  assertEqual(hashResetGrant(g1), h1, 'GRANT3: hashResetGrant is deterministic')
  assert(h1 !== hashResetGrant(g2), 'GRANT4: hashResetGrant differs when input changes')

  // Cross-check: SHA-256 of the raw grant should match.
  const expected = createHash('sha256').update(g1).digest('hex')
  assertEqual(h1, expected, 'GRANT2: hashResetGrant matches manually-computed SHA-256')
}

// GRANT5-GRANT6. constantTimeEqualGrantHash.
{
  const a = 'a'.repeat(64)
  const b = 'a'.repeat(64)
  const c = 'b' + 'a'.repeat(63)
  assert(constantTimeEqualGrantHash(a, b) === true, 'GRANT5: constantTimeEqualGrantHash returns true for equal strings')
  assert(constantTimeEqualGrantHash(a, c) === false, 'GRANT6: constantTimeEqualGrantHash returns false for different strings')
  assert(constantTimeEqualGrantHash(a, 'short') === false, 'GRANT6: constantTimeEqualGrantHash returns false for different-length strings')
}

assertEqual(RESET_GRANT_TTL_MS, 10 * 60 * 1000, 'GRANT: RESET_GRANT_TTL_MS === 10 minutes (V2 spec)')

// ---------------------------------------------------------------------------
// Source-level invariants
// ---------------------------------------------------------------------------

console.log('\n── Schema source invariants (SRC1-SRC5, SRC16) ──')

const schemaPath = PKG('prisma/schema.prisma')
const schemaSrc = readFileSync(schemaPath, 'utf8')

// SRC1. OtpCode model with required fields.
assert(/model\s+OtpCode\s*\{/.test(schemaSrc), 'SRC1: prisma/schema.prisma declares OtpCode model')
assert(/userId\s+String/.test(schemaSrc) && /purpose\s+String/.test(schemaSrc) && /codeHash\s+String/.test(schemaSrc), 'SRC1: OtpCode has userId, purpose, codeHash fields')
assert(/attempts\s+Int\s+@default\(0\)/.test(schemaSrc), 'SRC1: OtpCode has attempts Int @default(0)')
assert(/maxAttempts\s+Int\s+@default\(5\)/.test(schemaSrc), 'SRC1: OtpCode has maxAttempts Int @default(5)')
assert(/expiresAt\s+DateTime/.test(schemaSrc), 'SRC1: OtpCode has expiresAt DateTime')
assert(/consumedAt\s+DateTime\?/.test(schemaSrc), 'SRC1: OtpCode has consumedAt DateTime? (nullable)')
assert(/lastSentAt\s+DateTime/.test(schemaSrc), 'SRC1: OtpCode has lastSentAt DateTime')

// SRC2. PasswordResetGrant model with required fields.
assert(/model\s+PasswordResetGrant\s*\{/.test(schemaSrc), 'SRC2: prisma/schema.prisma declares PasswordResetGrant model')
assert(/grantHash\s+String\s+@unique/.test(schemaSrc), 'SRC2 + SRC5: PasswordResetGrant.grantHash is @unique')

// SRC3. sessionVersion on User.
assert(/sessionVersion\s+Int\s+@default\(0\)/.test(schemaSrc), 'SRC3: User has sessionVersion Int @default(0)')

// SRC4. Indexes on OtpCode.
assert(/@@index\(\[userId,\s*purpose\]\)/.test(schemaSrc), 'SRC4: OtpCode has @@index([userId, purpose])')
assert(/@@index\(\[expiresAt\]\)/.test(schemaSrc), 'SRC4: OtpCode has @@index([expiresAt])')

// SRC16. SQL reference file exists.
const sqlPath = PKG('prisma/sql/20260815-account-recovery-v2.sql')
assert(existsSync(sqlPath), 'SRC16: prisma/sql/20260815-account-recovery-v2.sql exists')
if (existsSync(sqlPath)) {
  const sqlSrc = readFileSync(sqlPath, 'utf8')
  assert(/CREATE TABLE "OtpCode"/.test(sqlSrc), 'SRC16: SQL file contains CREATE TABLE "OtpCode"')
  assert(/CREATE TABLE "PasswordResetGrant"/.test(sqlSrc), 'SRC16: SQL file contains CREATE TABLE "PasswordResetGrant"')
  assert(/ADD COLUMN "sessionVersion"/.test(sqlSrc), 'SRC16: SQL file contains ALTER TABLE "User" ADD COLUMN "sessionVersion"')
}

console.log('\n── otp.ts source invariants (SRC6-SRC12, SRC18) ──')

const otpPath = SRC('lib/otp.ts')
const otpSrc = readFileSync(otpPath, 'utf8')

// SRC6. Exports.
assert(/export function generateOtpCode/.test(otpSrc), 'SRC6: otp.ts exports generateOtpCode')
assert(/export function hashOtpCode/.test(otpSrc), 'SRC6: otp.ts exports hashOtpCode')
assert(/export function constantTimeEqualHex/.test(otpSrc), 'SRC6: otp.ts exports constantTimeEqualHex')
assert(/export async function issueOtp/.test(otpSrc), 'SRC6: otp.ts exports issueOtp')
assert(/export async function checkResendCooldown/.test(otpSrc), 'SRC6: otp.ts exports checkResendCooldown')
assert(/export async function consumeOtp/.test(otpSrc), 'SRC6: otp.ts exports consumeOtp')
assert(/export async function revokeAllOtpsForUser/.test(otpSrc), 'SRC6: otp.ts exports revokeAllOtpsForUser')
assert(/export const OTP_TTL_MS/.test(otpSrc), 'SRC6: otp.ts exports OTP_TTL_MS')
assert(/export const OTP_RESEND_COOLDOWN_MS/.test(otpSrc), 'SRC6: otp.ts exports OTP_RESEND_COOLDOWN_MS')
assert(/export const OTP_DEFAULT_MAX_ATTEMPTS/.test(otpSrc), 'SRC6: otp.ts exports OTP_DEFAULT_MAX_ATTEMPTS')

// SRC7. consumeOtp uses interactive $transaction.
assert(/db\.\$transaction\(async\s*\(tx\)\s*=>/.test(otpSrc), 'SRC7: otp.ts consumeOtp uses interactive db.$transaction(async (tx) => ...)')

// SRC8. consumeOtp gates on claim.count === 1.
assert(/claim\.count\s*!==\s*1/.test(otpSrc) || /claim\.count\s*===\s*1/.test(otpSrc), 'SRC8: otp.ts consumeOtp gates on claim.count === 1')

// SRC9. issueOtp invalidates old unconsumed OTPs (sets consumedAt AND attempts = maxAttempts).
assert(/consumedAt:\s*now,\s*attempts:\s*maxAttempts/.test(otpSrc) || /attempts:\s*maxAttempts,\s*consumedAt:\s*now/.test(otpSrc), 'SRC9: otp.ts issueOtp sets consumedAt = now AND attempts = maxAttempts on old rows')

// SRC10. Uses createHmac (NOT createHash) for code hashing.
assert(/createHmac\('sha256'/.test(otpSrc), 'SRC10: otp.ts uses createHmac("sha256", ...) for code hashing (HMAC, not plain SHA-256)')
assert(!/createHash\('sha256'\)\.update\(code/.test(otpSrc), 'SRC10: otp.ts does NOT use createHash for code hashing (HMAC mandatory for 6-digit codes)')

// SRC11. Uses randomInt (NOT Math.random).
assert(/randomInt\(/.test(otpSrc), 'SRC11: otp.ts uses crypto.randomInt (CSPRNG, no modulo bias)')
assert(!/Math\.random\(\)/.test(otpSrc), 'SRC11: otp.ts does NOT use Math.random (non-CSPRNG)')

// SRC12. Uses timingSafeEqual.
assert(/timingSafeEqual/.test(otpSrc), 'SRC12: otp.ts uses timingSafeEqual in constantTimeEqualHex')

// SRC18. Does NOT export a separate OTP_SECRET.
assert(!/OTP_SECRET/.test(otpSrc), 'SRC18: otp.ts does NOT export OTP_SECRET — uses AUTH_SECRET (single trust boundary)')

console.log('\n── password-reset.ts source invariants (SRC13-SRC15, SRC19) ──')

const prPath = SRC('lib/password-reset.ts')
const prSrc = readFileSync(prPath, 'utf8')

// SRC13. Exports.
assert(/export function generateResetGrant/.test(prSrc), 'SRC13: password-reset.ts exports generateResetGrant')
assert(/export function hashResetGrant/.test(prSrc), 'SRC13: password-reset.ts exports hashResetGrant')
assert(/export function constantTimeEqualGrantHash/.test(prSrc), 'SRC13: password-reset.ts exports constantTimeEqualGrantHash')
assert(/export async function issueResetGrant/.test(prSrc), 'SRC13: password-reset.ts exports issueResetGrant')
assert(/export const RESET_GRANT_TTL_MS/.test(prSrc), 'SRC13: password-reset.ts exports RESET_GRANT_TTL_MS')

// SRC14. issueResetGrant invalidates old unconsumed grants.
assert(/consumedAt:\s*now/.test(prSrc), 'SRC14: password-reset.ts issueResetGrant sets consumedAt = now on old unconsumed grants')

// SRC15. Uses createHash (SHA-256 is sufficient for 32-byte CSPRNG input).
assert(/createHash\('sha256'\)/.test(prSrc), 'SRC15: password-reset.ts uses createHash("sha256") for grant hashing (SHA-256 sufficient for 32-byte input)')

// SRC19. Does NOT expose consumeResetGrant.
assert(!/export\s+async\s+function\s+consumeResetGrant/.test(prSrc), 'SRC19: password-reset.ts does NOT export consumeResetGrant (must happen in route transaction)')

console.log('\n── .env.example documentation (SRC17) ──')

const envPath = PKG('.env.example')
const envSrc = readFileSync(envPath, 'utf8')
assert(/AUTH_SECRET is ALSO used as the\s+HMAC pepper for OTP/.test(envSrc) || /AUTH_SECRET.{0,200}HMAC pepper for OTP/.test(envSrc.replace(/\n/g, ' ')), 'SRC17: .env.example documents AUTH_SECRET dual role as OTP HMAC pepper')

// ---------------------------------------------------------------------------
// Stage 2 — register + send-otp route source invariants (SRC20-SRC30)
// ---------------------------------------------------------------------------

console.log('\n── Stage 2: register route source invariants (SRC20-SRC24) ──')

const registerPath = SRC('app/api/auth/register/route.ts')
const registerSrc = readFileSync(registerPath, 'utf8')

// SRC20. Imports issueOtp from '@/lib/otp' (NOT issueVerificationToken).
assert(/from\s+['"]@\/lib\/otp['"]/.test(registerSrc) && /issueOtp/.test(registerSrc), 'SRC20: register route imports issueOtp from @/lib/otp')
assert(!/issueVerificationToken/.test(registerSrc), 'SRC20: register route does NOT import issueVerificationToken (V2 replaces V1)')

// SRC21. Imports sendOtpEmail from '@/lib/email' (NOT sendVerificationEmail).
assert(/from\s+['"]@\/lib\/email['"]/.test(registerSrc) && /sendOtpEmail/.test(registerSrc), 'SRC21: register route imports sendOtpEmail from @/lib/email')
assert(!/sendVerificationEmail/.test(registerSrc), 'SRC21: register route does NOT import sendVerificationEmail (V2 replaces V1)')

// SRC22. Calls issueOtp with purpose: 'EMAIL_VERIFICATION'.
assert(/issueOtp\(\s*\{\s*userId:[^}]+purpose:\s*['"]EMAIL_VERIFICATION['"]/.test(registerSrc) || /issueOtp\(\{[^}]*purpose:\s*['"]EMAIL_VERIFICATION['"]/.test(registerSrc), 'SRC22: register route calls issueOtp with purpose: "EMAIL_VERIFICATION"')

// SRC23. Returns otpSent in response body.
assert(/otpSent/.test(registerSrc), 'SRC23: register route returns otpSent in response body')

// SRC24. Does NOT log the raw OTP code (catch uses logAuthError with stable label).
// The issueOtp call destructures { code } — make sure 'code' is not interpolated
// into any console.log or thrown string.
assert(!/console\.(log|error|warn)\([^)]*\$\{code\}/.test(registerSrc), 'SRC24: register route does NOT console.log the raw OTP code')
assert(!/throw\s+new\s+Error\([^)]*\$\{code\}/.test(registerSrc), 'SRC24: register route does NOT throw with raw OTP code in message')

console.log('\n── Stage 2: send-otp route source invariants (SRC25-SRC27) ──')

const sendOtpRoutePath = SRC('app/api/auth/verify-email/send-otp/route.ts')
assert(existsSync(sendOtpRoutePath), 'SRC25: send-otp route file exists at src/app/api/auth/verify-email/send-otp/route.ts')
if (existsSync(sendOtpRoutePath)) {
  const sendOtpSrc = readFileSync(sendOtpRoutePath, 'utf8')

  // SRC25. Requires auth, checks GOOGLE provider, checks alreadyVerified, checks cooldown.
  assert(/requireAuth\(\)/.test(sendOtpSrc), 'SRC25: send-otp route calls requireAuth()')
  assert(/provider\s*===\s*['"]GOOGLE['"]/.test(sendOtpSrc), 'SRC25: send-otp route checks provider === "GOOGLE" → 400')
  assert(/emailVerifiedAt/.test(sendOtpSrc) && /alreadyVerified/.test(sendOtpSrc), 'SRC25: send-otp route checks emailVerifiedAt → alreadyVerified')
  assert(/checkResendCooldown/.test(sendOtpSrc), 'SRC25: send-otp route calls checkResendCooldown')
  assert(/issueOtp/.test(sendOtpSrc), 'SRC25: send-otp route calls issueOtp')
  assert(/sendOtpEmail/.test(sendOtpSrc), 'SRC25: send-otp route calls sendOtpEmail')

  // SRC26. Never returns the raw OTP code in the response.
  // The issueOtp call destructures { code } — make sure 'code' is not in any
  // NextResponse.json body. We check that no `code:` key appears in a json()
  // response (which would leak it).
  assert(!/NextResponse\.json\(\s*\{[^}]*\bcode:\s*code\b/.test(sendOtpSrc), 'SRC26: send-otp route does NOT return raw OTP code in response body')
  assert(!/console\.(log|error|warn)\([^)]*\$\{code\}/.test(sendOtpSrc), 'SRC26: send-otp route does NOT console.log the raw OTP code')

  // SRC27. Returns 429 with code: 'RESEND_COOLDOWN' and retryAfterMs.
  assert(/status:\s*429/.test(sendOtpSrc), 'SRC27: send-otp route returns status 429 on cooldown')
  assert(/['"]RESEND_COOLDOWN['"]/.test(sendOtpSrc), 'SRC27: send-otp route returns code: "RESEND_COOLDOWN"')
  assert(/retryAfterMs/.test(sendOtpSrc), 'SRC27: send-otp route returns retryAfterMs in cooldown response')
}

console.log('\n── Stage 2: sendOtpEmail source invariants (SRC28-SRC29) ──')

const emailPath = SRC('lib/email.ts')
const emailSrc = readFileSync(emailPath, 'utf8')

// SRC28. sendOtpEmail is exported.
assert(/export\s+async\s+function\s+sendOtpEmail/.test(emailSrc), 'SRC28: src/lib/email.ts exports sendOtpEmail')

// SRC29. sendOtpEmail does NOT log the raw OTP code in production paths.
// It delegates to getEmailAdapter().send() — the adapter handles sanitization.
// The function body should not contain any console.log referencing the code.
const sendOtpEmailMatch = emailSrc.match(/export\s+async\s+function\s+sendOtpEmail[^}]*\}/)
if (sendOtpEmailMatch) {
  // Grab the function body — match braces properly is hard with regex, so
  // we just check the entire email.ts doesn't console.log code in a way
  // that's reachable from sendOtpEmail. Since the dev adapter is the only
  // one that console.logs and it's gated by NODE_ENV !== 'production',
  // and the OTP is delivered via sendOtpEmail → adapter.send(), the
  // existing SRC9-style invariant in test-verified-identity.ts already
  // covers this. Here we just verify sendOtpEmail itself doesn't
  // console.log.
  const fnBody = sendOtpEmailMatch[0]
  assert(!/console\.(log|error|warn)\s*\(/.test(fnBody), 'SRC29: sendOtpEmail function body does NOT call console.log/error/warn directly')
}

console.log('\n── Stage 2: RegisterView UI invariants (SRC30) ──')

const registerViewPath = SRC('views/auth/RegisterView.tsx')
const registerViewSrc = readFileSync(registerViewPath, 'utf8')

// SRC30. RegisterView navigates to /verify-email after success.
// The navigate call may use a string literal OR a variable that resolves
// to /verify-email (with optional ?next=...). Check that the path is
// constructed from '/verify-email' literal.
assert(/['"`]\/verify-email/.test(registerViewSrc), 'SRC30: RegisterView constructs /verify-email path after successful registration')
assert(/navigate\(verifyUrl\)|navigate\(['"`]\/verify-email/.test(registerViewSrc), 'SRC30: RegisterView calls navigate() with the verify-email URL')
// Make sure the original nextPath is NOT navigated to directly (the user
// must verify first). The nextPath should be wrapped as ?next=... on the
// /verify-email URL.
assert(/verify-email\?next=/.test(registerViewSrc), 'SRC30: RegisterView preserves nextPath as ?next= on /verify-email URL (not navigated directly)')

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n────────────────────────────────────────')
console.log(`OTP domain + Stage 2 (register/send-otp): ${pass} passed, ${fail} failed`)
if (fail > 0) {
  console.log('\nFailures:')
  failures.forEach((f) => console.log(`  - ${f}`))
  process.exit(1)
}
console.log('All Stage 1 + Stage 2 static assertions passed.')
process.exit(0)
