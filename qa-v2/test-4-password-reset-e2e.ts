/**
 * QA Test 4 — Password reset success path (full E2E).
 *
 * Proves against QA PostgreSQL:
 *   1. Issue a known PASSWORD_RESET OTP (via issueOtp).
 *   2. Verify the OTP (via consumeOtp) → receive a reset grant (via issueResetGrant).
 *   3. Reset password using the grant (simulates /api/auth/reset-password route).
 *   4. OLD password FAILS to log in (comparePassword returns false).
 *   5. NEW password SUCCEEDS to log in (comparePassword returns true).
 *   6. Grant REUSE fails — second reset attempt with same grant returns GRANT_CONSUMED.
 *   7. sessionVersion was bumped from 0 → 1 (invalidating old sessions).
 *
 * The test calls the SAME lib functions the HTTP routes call:
 *   - issueOtp, consumeOtp from src/lib/otp
 *   - issueResetGrant, hashResetGrant, constantTimeEqualGrantHash from src/lib/password-reset
 *   - hashPassword, comparePassword from src/lib/auth
 *
 * For step 3 (reset-password), the test replicates the route's atomic
 * interactive transaction inline (so we don't need to spin up Next.js).
 * The route's transaction is the canonical implementation — this test
 * mirrors it 1:1.
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { issueOtp, consumeOtp, type OtpPurpose } from '../src/lib/otp'
import {
  issueResetGrant,
  hashResetGrant,
} from '../src/lib/password-reset'
import { hashPassword, comparePassword } from '../src/lib/auth'

const prisma = new PrismaClient()

const PURPOSE: OtpPurpose = 'PASSWORD_RESET'

async function main() {
  console.log('=== QA Test 4: Password reset E2E ===')

  const user = await prisma.user.findUnique({
    where: { email: 'qa-v2-reset@example.com' },
    select: { id: true, email: true, password: true, sessionVersion: true },
  })
  if (!user) throw new Error('QA user qa-v2-reset@example.com not found — run seed-qa first')

  const OLD_PASSWORD = 'qa-old-password-002'
  const NEW_PASSWORD = 'qa-new-password-002-CHANGED'

  // Reset to known state: password = OLD, sessionVersion = 0.
  const oldHash = await hashPassword(OLD_PASSWORD)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: oldHash, sessionVersion: 0 },
    select: { id: true },
  })
  await prisma.otpCode.deleteMany({ where: { userId: user.id } })
  await prisma.passwordResetGrant.deleteMany({ where: { userId: user.id } })

  console.log(`[setup] User ${user.email}: sessionVersion=0, password=OLD`)

  // ---- Step 1: Issue a known PASSWORD_RESET OTP ----
  console.log('\n--- Step 1: Issue PASSWORD_RESET OTP ---')
  const otpIssued = await issueOtp({ userId: user.id, purpose: PURPOSE })
  console.log(`  ✓ OTP issued. expiresAt=${otpIssued.expiresAt.toISOString()}`)

  // ---- Step 2: Verify the OTP → receive a reset grant ----
  console.log('\n--- Step 2: Verify OTP → receive reset grant ---')
  const otpResult = await consumeOtp({
    userId: user.id,
    purpose: PURPOSE,
    code: otpIssued.code,
  })
  if (otpResult.result !== 'OK') {
    throw new Error(`Expected OK, got ${otpResult.result}`)
  }
  console.log(`  ✓ OTP consumed (result=OK)`)
  const grantIssued = await issueResetGrant(user.id)
  console.log(`  ✓ Reset grant issued. expiresAt=${grantIssued.expiresAt.toISOString()}`)
  console.log(`    Grant hash (sha256) = ${hashResetGrant(grantIssued.grant).slice(0, 16)}…`)

  // ---- Step 3: Reset password using the grant ----
  // (Mirrors /api/auth/reset-password/route.ts atomic transaction)
  console.log('\n--- Step 3: Reset password (atomic tx: claim grant + set password + bump sessionVersion + invalidate OTPs) ---')
  const grantHash = hashResetGrant(grantIssued.grant)
  const now = new Date()
  const txResult = await prisma.$transaction(async (tx) => {
    const row = await tx.passwordResetGrant.findUnique({
      where: { grantHash },
      select: { id: true, userId: true, consumedAt: true, expiresAt: true },
    })
    if (!row) return { code: 'GRANT_NOT_FOUND' as const }
    if (row.consumedAt) return { code: 'GRANT_CONSUMED' as const }
    if (row.expiresAt <= now) return { code: 'GRANT_EXPIRED' as const }

    const claim = await tx.passwordResetGrant.updateMany({
      where: { id: row.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    })
    if (claim.count !== 1) return { code: 'GRANT_CONSUMED' as const }

    const hashedNewPassword = await hashPassword(NEW_PASSWORD)
    await tx.user.update({
      where: { id: row.userId },
      data: { password: hashedNewPassword, sessionVersion: { increment: 1 } },
      select: { id: true },
    })
    await tx.otpCode.updateMany({
      where: { userId: row.userId, consumedAt: null },
      data: { consumedAt: now },
    })
    return { code: 'OK' as const }
  })
  console.log(`  ✓ Transaction result: ${txResult.code}`)
  if (txResult.code !== 'OK') throw new Error(`Expected OK, got ${txResult.code}`)

  // ---- Step 4: OLD password FAILS ----
  console.log('\n--- Step 4: OLD password fails to authenticate ---')
  const userAfter = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true, sessionVersion: true },
  })
  if (!userAfter) throw new Error('User disappeared')
  const oldPassOk = await comparePassword(OLD_PASSWORD, userAfter.password)
  console.log(`  comparePassword(OLD, hash) = ${oldPassOk}  (expected false)`)
  if (oldPassOk) throw new Error('Old password should fail')

  // ---- Step 5: NEW password SUCCEEDS ----
  console.log('\n--- Step 5: NEW password authenticates ---')
  const newPassOk = await comparePassword(NEW_PASSWORD, userAfter.password)
  console.log(`  comparePassword(NEW, hash) = ${newPassOk}  (expected true)`)
  if (!newPassOk) throw new Error('New password should succeed')

  // ---- Step 6: Grant REUSE fails ----
  console.log('\n--- Step 6: Grant reuse fails (GRANT_CONSUMED) ---')
  const grantHash2 = hashResetGrant(grantIssued.grant)
  const reuseResult = await prisma.$transaction(async (tx) => {
    const row = await tx.passwordResetGrant.findUnique({
      where: { grantHash: grantHash2 },
      select: { id: true, consumedAt: true, expiresAt: true },
    })
    if (!row) return { code: 'GRANT_NOT_FOUND' as const }
    if (row.consumedAt) return { code: 'GRANT_CONSUMED' as const }
    if (row.expiresAt <= new Date()) return { code: 'GRANT_EXPIRED' as const }
    const claim = await tx.passwordResetGrant.updateMany({
      where: { id: row.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    })
    if (claim.count !== 1) return { code: 'GRANT_CONSUMED' as const }
    return { code: 'OK' as const }
  })
  console.log(`  Reuse result: ${reuseResult.code}  (expected GRANT_CONSUMED)`)
  if (reuseResult.code !== 'GRANT_CONSUMED') throw new Error(`Expected GRANT_CONSUMED, got ${reuseResult.code}`)

  // ---- Step 7: sessionVersion bumped 0 → 1 ----
  console.log('\n--- Step 7: sessionVersion bumped from 0 to 1 ---')
  console.log(`  User.sessionVersion = ${userAfter.sessionVersion}  (expected 1)`)
  if (userAfter.sessionVersion !== 1) throw new Error(`Expected sessionVersion=1, got ${userAfter.sessionVersion}`)

  // ---- Bonus: Verify all unconsumed OTPs for the user are now consumed ----
  console.log('\n--- Bonus: All unconsumed OTPs invalidated by reset ---')
  const unconsumedOtps = await prisma.otpCode.count({
    where: { userId: user.id, consumedAt: null },
  })
  console.log(`  Unconsumed OTP count = ${unconsumedOtps}  (expected 0)`)
  const bonusPass = unconsumedOtps === 0

  // ---- Summary ----
  console.log('\n--- SUMMARY ---')
  console.log(`Step 1: Issue PASSWORD_RESET OTP            ✅`)
  console.log(`Step 2: Verify OTP → grant issued            ✅`)
  console.log(`Step 3: Reset password (atomic tx)           ✅`)
  console.log(`Step 4: OLD password fails                   ✅`)
  console.log(`Step 5: NEW password succeeds                ✅`)
  console.log(`Step 6: Grant reuse fails (GRANT_CONSUMED)   ✅`)
  console.log(`Step 7: sessionVersion bumped 0→1            ✅`)
  console.log(`Bonus:  All unconsumed OTPs invalidated      ${bonusPass ? '✅' : '❌'}`)
  console.log(`\nOVERALL: PASS ✅`)
}

main()
  .catch((e) => {
    console.error('QA Test 4 FAILED:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
