/**
 * QA Test 2 (REVISED) — OTP resend concurrency race fix.
 *
 * This is the NEW Test 2 that verifies the fix for the resend-concurrency
 * race documented in the previous V2 QA report (Test 2 Run A failure).
 *
 * The fix (see src/lib/otp.ts):
 *   - `issueOtp` now acquires `pg_advisory_xact_lock(hashtext(userId || ':' || purpose))`
 *     inside an interactive transaction.
 *   - The cooldown check happens AFTER the lock (re-read authoritative state).
 *   - If cooldown elapsed: invalidate old unconsumed OTPs, create new one, COMMIT.
 *   - If cooldown active: return COOLDOWN without inserting.
 *   - Only the ISSUED caller is allowed to send the email.
 *
 * Plus a DB-level backstop: partial unique index
 *   CREATE UNIQUE INDEX OtpCode_userId_purpose_active_uniq
 *   ON OtpCode(userId, purpose) WHERE consumedAt IS NULL
 *
 * SCENARIOS (per operator spec):
 *   A. Pure parallel initial issuance — 10 simultaneous issueOtp() calls
 *      against a (userId, purpose) with NO prior OTP.
 *      Expected: 1 ISSUED, 9 COOLDOWN, 1 unconsumed OTP row.
 *
 *   B. Parallel resend after cooldown — prepare one old challenge >60s old,
 *      then 10 simultaneous issueOtp() calls.
 *      Expected: 1 ISSUED, 9 COOLDOWN, old OTP invalidated, 1 unconsumed remains.
 *
 *   C. Repro stress — repeat A and B 50 times each. Expected: 0 runs with
 *      >1 unconsumed OTP.
 *
 *   D. Email-send ownership — install a counting email adapter, run 10
 *      concurrent resend requests, prove sendOtpEmail was called EXACTLY ONCE.
 *      (See test-2d-email-send-ownership.ts — separate file.)
 *
 * This file covers A, B, C. Test D is in a separate file because it
 * needs the email-adapter test seam.
 *
 * Run with:
 *   bun run qa-v2/test-2-otp-resend.ts
 *
 * Aborts immediately if NODE_ENV=production. All asserts are static.
 */

import { PrismaClient } from '@prisma/client'
import { issueOtp, type OtpPurpose } from '../src/lib/otp'

const prisma = new PrismaClient()

const PURPOSE: OtpPurpose = 'EMAIL_VERIFICATION'

interface RunResult {
  scenario: string
  issued: number
  cooldown: number
  finalUnconsumedCount: number
  pass: boolean
  detail?: string
}

async function countUnconsumed(userId: string): Promise<number> {
  return prisma.otpCode.count({
    where: { userId, purpose: PURPOSE, consumedAt: null },
  })
}

async function runScenarioA(userId: string): Promise<RunResult> {
  // Scenario A — Pure parallel initial issuance.
  // Clean slate: no prior OTP for this user.
  await prisma.otpCode.deleteMany({ where: { userId, purpose: PURPOSE } })

  const N = 10
  const outcomes = await Promise.all(
    Array.from({ length: N }, () => issueOtp({ userId, purpose: PURPOSE }))
  )
  const issued = outcomes.filter((o) => o.result === 'ISSUED').length
  const cooldown = outcomes.filter((o) => o.result === 'COOLDOWN').length
  const finalUnconsumedCount = await countUnconsumed(userId)

  const pass =
    issued === 1 &&
    cooldown === N - 1 &&
    finalUnconsumedCount === 1
  return {
    scenario: 'A',
    issued,
    cooldown,
    finalUnconsumedCount,
    pass,
    detail: pass ? undefined : `expected 1 ISSUED + 9 COOLDOWN + 1 unconsumed; got ${issued}/${cooldown}/${finalUnconsumedCount}`,
  }
}

async function runScenarioB(userId: string): Promise<RunResult> {
  // Scenario B — Parallel resend after cooldown.
  // Step 1: prepare one old challenge older than 60 seconds.
  await prisma.otpCode.deleteMany({ where: { userId, purpose: PURPOSE } })
  const oldSentAt = new Date(Date.now() - 90_000) // 90s ago — past 60s cooldown
  const oldExpiresAt = new Date(Date.now() + 5 * 60 * 1000) // still valid (5 min from now)
  // We need to bypass `issueOtp` to set lastSentAt to a past timestamp.
  // Insert directly via Prisma. codeHash is irrelevant — we won't verify this OTP.
  const oldRow = await prisma.otpCode.create({
    data: {
      userId,
      purpose: PURPOSE,
      codeHash: 'dummy-hash-for-old-row-' + Date.now(),
      attempts: 0,
      maxAttempts: 5,
      expiresAt: oldExpiresAt,
      consumedAt: null,
      lastSentAt: oldSentAt,
    },
  })

  // Step 2: 10 simultaneous resend requests.
  const N = 10
  const outcomes = await Promise.all(
    Array.from({ length: N }, () => issueOtp({ userId, purpose: PURPOSE }))
  )
  const issued = outcomes.filter((o) => o.result === 'ISSUED').length
  const cooldown = outcomes.filter((o) => o.result === 'COOLDOWN').length
  const finalUnconsumedCount = await countUnconsumed(userId)

  // Verify the OLD row was invalidated (consumedAt is now set).
  const oldRowAfter = await prisma.otpCode.findUnique({
    where: { id: oldRow.id },
    select: { consumedAt: true },
  })
  const oldRowInvalidated = oldRowAfter?.consumedAt !== null

  const pass =
    issued === 1 &&
    cooldown === N - 1 &&
    finalUnconsumedCount === 1 &&
    oldRowInvalidated
  return {
    scenario: 'B',
    issued,
    cooldown,
    finalUnconsumedCount,
    pass,
    detail: pass
      ? undefined
      : `expected 1 ISSUED + 9 COOLDOWN + 1 unconsumed + old invalidated; got ${issued}/${cooldown}/${finalUnconsumedCount}/oldInvalidated=${oldRowInvalidated}`,
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('REFUSING TO RUN QA IN PRODUCTION — would mutate data.')
    process.exit(1)
  }

  console.log('=== QA Test 2 (REVISED): OTP resend concurrency race fix ===')
  console.log('Fix: pg_advisory_xact_lock + partial unique index backstop')
  console.log('')

  // Sanity: confirm the partial unique index exists.
  const indexes = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND tablename='OtpCode'
      AND indexname='OtpCode_userId_purpose_active_uniq'
  `
  if (indexes.length === 0) {
    console.error('FAIL: partial unique index OtpCode_userId_purpose_active_uniq is missing.')
    console.error('Apply prisma/sql/20260815-otp-active-uniq-backstop.sql first.')
    process.exit(1)
  }
  console.log('[setup] Partial unique index backstop: PRESENT ✅')

  const user = await prisma.user.findUnique({
    where: { email: 'qa-v2-verify@example.com' },
    select: { id: true },
  })
  if (!user) throw new Error('QA user not found — run seed-qa first')

  // ====================================================================
  // SCENARIO A — Pure parallel initial issuance (single shot)
  // ====================================================================
  console.log('\n--- Scenario A: 10 parallel initial issueOtp ---')
  const A = await runScenarioA(user.id)
  console.log(`[A] issued=${A.issued}, cooldown=${A.cooldown}, unconsumed=${A.finalUnconsumedCount}`)
  console.log(`[A] RESULT: ${A.pass ? 'PASS ✅' : 'FAIL ❌'}${A.detail ? ' — ' + A.detail : ''}`)

  // ====================================================================
  // SCENARIO B — Parallel resend after cooldown (single shot)
  // ====================================================================
  console.log('\n--- Scenario B: 10 parallel resend with old challenge >60s old ---')
  const B = await runScenarioB(user.id)
  console.log(`[B] issued=${B.issued}, cooldown=${B.cooldown}, unconsumed=${B.finalUnconsumedCount}`)
  console.log(`[B] RESULT: ${B.pass ? 'PASS ✅' : 'FAIL ❌'}${B.detail ? ' — ' + B.detail : ''}`)

  // ====================================================================
  // SCENARIO C — Stress test: 50 iterations of A and B
  // ====================================================================
  console.log('\n--- Scenario C: 50-iteration stress of A and B ---')
  const ITERATIONS = 50
  let aFailures = 0
  let bFailures = 0
  let aMaxUnconsumed = 0
  let bMaxUnconsumed = 0
  const aFailDetails: string[] = []
  const bFailDetails: string[] = []

  for (let i = 0; i < ITERATIONS; i++) {
    const a = await runScenarioA(user.id)
    if (!a.pass) {
      aFailures++
      if (aFailDetails.length < 5) aFailDetails.push(`iter ${i}: ${a.detail}`)
    }
    aMaxUnconsumed = Math.max(aMaxUnconsumed, a.finalUnconsumedCount)

    const b = await runScenarioB(user.id)
    if (!b.pass) {
      bFailures++
      if (bFailDetails.length < 5) bFailDetails.push(`iter ${i}: ${b.detail}`)
    }
    bMaxUnconsumed = Math.max(bMaxUnconsumed, b.finalUnconsumedCount)

    if ((i + 1) % 10 === 0) {
      console.log(
        `[C] iter ${i + 1}/${ITERATIONS}: A failures=${aFailures} (max unconsumed=${aMaxUnconsumed}), ` +
          `B failures=${bFailures} (max unconsumed=${bMaxUnconsumed})`
      )
    }
  }
  console.log(`[C] A: ${ITERATIONS - aFailures}/${ITERATIONS} passed, max unconsumed=${aMaxUnconsumed}`)
  console.log(`[C] B: ${ITERATIONS - bFailures}/${ITERATIONS} passed, max unconsumed=${bMaxUnconsumed}`)
  if (aFailDetails.length > 0) {
    console.log(`[C] A first failures:`)
    aFailDetails.forEach((d) => console.log(`     - ${d}`))
  }
  if (bFailDetails.length > 0) {
    console.log(`[C] B first failures:`)
    bFailDetails.forEach((d) => console.log(`     - ${d}`))
  }

  const cPass = aFailures === 0 && bFailures === 0
  console.log(`[C] RESULT: ${cPass ? 'PASS ✅' : 'FAIL ❌'}`)

  // ====================================================================
  // SUMMARY
  // ====================================================================
  console.log('\n--- SUMMARY ---')
  console.log(`Scenario A (single shot):    ${A.pass ? 'PASS ✅' : 'FAIL ❌'}`)
  console.log(`Scenario B (single shot):    ${B.pass ? 'PASS ✅' : 'FAIL ❌'}`)
  console.log(`Scenario C (50 iterations):  ${cPass ? 'PASS ✅' : 'FAIL ❌'}`)
  console.log('')
  console.log(`Invariant "at most ONE unconsumed OTP per (userId, purpose)":`)
  console.log(`  A: max unconsumed across ${ITERATIONS} runs = ${aMaxUnconsumed} (expected 1)`)
  console.log(`  B: max unconsumed across ${ITERATIONS} runs = ${bMaxUnconsumed} (expected 1)`)

  const overallPass = A.pass && B.pass && cPass
  console.log(`\nOVERALL: ${overallPass ? 'PASS ✅' : 'FAIL ❌'}`)
  if (!overallPass) process.exit(1)
}

main()
  .catch((e) => {
    console.error('QA Test 2 (revised) FAILED:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
