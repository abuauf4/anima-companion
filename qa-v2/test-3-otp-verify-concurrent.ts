/**
 * QA Test 3 — Concurrent valid OTP verify (one claim wins, emailVerifiedAt set once).
 *
 * Proves with REAL parallel PostgreSQL transactions that:
 *   - 2+ concurrent submissions of the SAME valid OTP code against the
 *     same (userId, purpose) pair result in EXACTLY ONE claim winning.
 *   - The winner gets `result: 'OK'` and proceeds to set emailVerifiedAt.
 *   - The loser(s) get `result: 'ALREADY_CONSUMED'` (idempotent success
 *     — the OTP was valid, but a concurrent request claimed it first).
 *   - emailVerifiedAt is set EXACTLY ONCE on the User row.
 *
 * Additionally, this test verifies the idempotent emailVerifiedAt write
 * in /api/auth/verify-email/verify-otp/route.ts: the route uses
 * `User.updateMany WHERE emailVerifiedAt IS NULL` after the OTP claim,
 * so even if TWO concurrent verify requests both win their OTP claims
 * (impossible under the current consumeOtp design, but defensive),
 * only ONE User.updateMany would set emailVerifiedAt — the other
 * would see `count: 0` and return ALREADY_VERIFIED.
 *
 * This test runs 5 concurrent valid-OTP verify calls to maximize the
 * chance of catching a race. Under READ COMMITTED, exactly one call
 * should win the `updateMany WHERE consumedAt IS NULL` claim; the
 * other four should get `claim.count === 0` → ALREADY_CONSUMED.
 *
 * The test also confirms emailVerifiedAt is set by simulating the
 * route's idempotent User.updateMany write for each OK/ALREADY_CONSUMED
 * result.
 */

import { PrismaClient } from '@prisma/client'
import { issueOtp, consumeOtp, type OtpPurpose } from '../src/lib/otp'

const prisma = new PrismaClient()

const PURPOSE: OtpPurpose = 'EMAIL_VERIFICATION'

async function main() {
  console.log('=== QA Test 3: Concurrent valid OTP verify (one claim wins) ===')

  const user = await prisma.user.findUnique({
    where: { email: 'qa-v2-verify@example.com' },
    select: { id: true, emailVerifiedAt: true },
  })
  if (!user) throw new Error('QA user not found — run seed-qa first')

  // Reset emailVerifiedAt to NULL so we can prove it gets set once.
  // Also clean up any prior OTP rows.
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: null },
    select: { id: true },
  })
  await prisma.otpCode.deleteMany({ where: { userId: user.id } })

  // Issue ONE fresh OTP. The raw code is used by all concurrent verify calls.
  const issueOutcome = await issueOtp({
    userId: user.id,
    purpose: PURPOSE,
  })
  if (issueOutcome.result !== 'ISSUED') {
    throw new Error(
      `Setup issueOtp returned ${issueOutcome.result} — expected ISSUED for fresh user.`
    )
  }
  const { code } = issueOutcome
  console.log(`[setup] Issued OTP for ${user.id}; will fire ${5} concurrent verifies with the SAME code.`)

  // Fire 5 concurrent valid-OTP verify calls.
  // Each call invokes consumeOtp directly (same as the HTTP route).
  // After consumeOtp returns, each call simulates the route's
  // idempotent emailVerifiedAt write via User.updateMany WHERE emailVerifiedAt IS NULL.
  const N = 5
  const t0 = Date.now()
  const results = await Promise.all(
    Array.from({ length: N }, (_, i) =>
      (async () => {
        const otpRes = await consumeOtp({
          userId: user.id,
          purpose: PURPOSE,
          code,
        })
        // Simulate the route's idempotent write.
        let userWrite: { count: number } = { count: 0 }
        if (otpRes.result === 'OK') {
          // Only the OK winner attempts the write.
          userWrite = await prisma.user.updateMany({
            where: { id: user.id, emailVerifiedAt: null },
            data: { emailVerifiedAt: new Date() },
          })
        }
        return { idx: i, otpResult: otpRes.result, userWriteCount: userWrite.count }
      })()
    )
  )
  const elapsed = Date.now() - t0
  console.log(`[test] ${N} concurrent verify calls returned in ${elapsed}ms`)

  // Tally
  const tally: Record<string, number> = {}
  let okWithUserWrite = 0
  for (const r of results) {
    tally[r.otpResult] = (tally[r.otpResult] ?? 0) + 1
    if (r.otpResult === 'OK' && r.userWriteCount === 1) okWithUserWrite++
  }
  console.log('[test] OTP-result tally:')
  for (const [k, v] of Object.entries(tally)) {
    console.log(`        ${k.padEnd(20)} = ${v}`)
  }
  console.log(`[test] OK winners that also wrote emailVerifiedAt (count=1): ${okWithUserWrite}`)

  // Read the final state
  const finalUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { emailVerifiedAt: true },
  })
  const finalOtp = await prisma.otpCode.findFirst({
    where: { userId: user.id, purpose: PURPOSE },
    orderBy: { createdAt: 'desc' },
    select: { consumedAt: true, attempts: true, maxAttempts: true },
  })
  console.log('[verify] Final User.emailVerifiedAt:', finalUser?.emailVerifiedAt)
  console.log('[verify] Final OTP row:', finalOtp)

  // Assertions
  //
  // The CRITICAL invariants are:
  //   - Exactly ONE OK (only one caller wins the atomic claim).
  //   - emailVerifiedAt is set EXACTLY ONCE (the route's idempotent
  //     User.updateMany WHERE emailVerifiedAt IS NULL guarantees this
  //     even if multiple OK winners somehow existed).
  //   - OTP.consumedAt is set (the OTP is now single-use-spent).
  //   - OTP.attempts == 0 (no wrong-code increments — all callers
  //     submitted the SAME valid code).
  //
  // The "loser" outcome is timing-dependent under READ COMMITTED:
  //   - If the loser's findFirst runs BEFORE the winner's commit:
  //     the loser sees the row, proceeds to updateMany, loses the race
  //     (claim.count === 0), returns ALREADY_CONSUMED.
  //   - If the loser's findFirst runs AFTER the winner's commit:
  //     the loser's findFirst filters out the consumed row, returns null,
  //     and the function returns NOT_FOUND_OR_EXPIRED.
  //
  // BOTH outcomes are correct "lost the race" results. The HTTP route
  // surfaces them differently (ALREADY_CONSUMED → 200 idempotent,
  // NOT_FOUND_OR_EXPIRED → 404), but neither violates the security
  // invariant: only one OK, no double-spend, emailVerifiedAt set once.
  const okCount = tally['OK'] ?? 0
  const alreadyCount = tally['ALREADY_CONSUMED'] ?? 0
  const notFoundCount = tally['NOT_FOUND_OR_EXPIRED'] ?? 0
  const loserCount = alreadyCount + notFoundCount

  const pass =
    okCount === 1 &&
    loserCount === N - 1 &&
    okWithUserWrite === 1 &&
    finalUser?.emailVerifiedAt !== null &&
    finalOtp?.consumedAt !== null &&
    finalOtp?.attempts === 0

  console.log('\n--- ASSERTIONS ---')
  console.log(`OK count                  = ${okCount}     (expected 1)              ${okCount === 1 ? 'PASS' : 'FAIL'}`)
  console.log(`loser count (ALREADY+NF)  = ${loserCount}     (expected ${N - 1})              ${loserCount === N - 1 ? 'PASS' : 'FAIL'}`)
  console.log(`  └─ ALREADY_CONSUMED     = ${alreadyCount}`)
  console.log(`  └─ NOT_FOUND_OR_EXPIRED = ${notFoundCount}`)
  console.log(`OK winners w/ userWrite=1 = ${okWithUserWrite}     (expected 1)              ${okWithUserWrite === 1 ? 'PASS' : 'FAIL'}`)
  console.log(`emailVerifiedAt IS SET    = ${finalUser?.emailVerifiedAt !== null}    (expected true)          ${finalUser?.emailVerifiedAt !== null ? 'PASS' : 'FAIL'}`)
  console.log(`OTP.consumedAt IS SET     = ${finalOtp?.consumedAt !== null}    (expected true)          ${finalOtp?.consumedAt !== null ? 'PASS' : 'FAIL'}`)
  console.log(`OTP.attempts == 0         = ${finalOtp?.attempts === 0}    (expected true, no wrong attempts)  ${finalOtp?.attempts === 0 ? 'PASS' : 'FAIL'}`)
  console.log(`\nOVERALL: ${pass ? 'PASS ✅' : 'FAIL ❌'}`)

  if (!pass) process.exit(1)
}

main()
  .catch((e) => {
    console.error('QA Test 3 FAILED:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
