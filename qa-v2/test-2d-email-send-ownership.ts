/**
 * QA Test 2-D — Email-send ownership under concurrent resend.
 *
 * Proves that when 10 concurrent `issueOtp` + `sendOtpEmail` calls fire
 * against the same (userId, purpose), the email adapter's `send()` is
 * called EXACTLY ONCE.
 *
 * This is the email-spam-prevention half of the resend-concurrency fix.
 * The other half (Test 2 — A/B/C) proves the DB invariant "at most one
 * unconsumed OTP per (userId, purpose)". This test proves the APPLICATION
 * invariant "at most one email per issuance burst".
 *
 * MECHANISM:
 *   - `issueOtp` returns `ISSUED` only to the SINGLE transaction that won
 *     the advisory lock + cooldown check + create. All other concurrent
 *     callers receive `COOLDOWN`.
 *   - The caller pattern (mirror of the production route):
 *       const outcome = await issueOtp({ userId, purpose })
 *       if (outcome.result === 'ISSUED') await sendOtpEmail(to, outcome.code, ...)
 *   - So `sendOtpEmail` is called only by the ISSUED winner. Losing
 *     callers receive COOLDOWN and skip the send entirely.
 *
 * TEST SEAM:
 *   We install a counting `EmailAdapter` via `__setEmailAdapterForTesting`
 *   (test-only seam in src/lib/email.ts — throws in production). The
 *   counting adapter increments a counter on each `send()` and records
 *   the message subjects (so we can verify all sends were OTP emails,
 *   not stray emails from other code paths).
 *
 * DO NOT send real email during concurrency QA — the counting adapter
 * intercepts the send and does nothing beyond counting.
 *
 * SCENARIOS:
 *   D1. 10 concurrent resend against (userId, EMAIL_VERIFICATION) with
 *       no prior OTP — expect 1 send.
 *   D2. 10 concurrent resend with prior OTP older than 60s — expect 1 send.
 *   D3. 5 iterations of D1 + D2 — all must have exactly 1 send.
 *
 * Run with:
 *   bun run qa-v2/test-2d-email-send-ownership.ts
 */

import { PrismaClient } from '@prisma/client'
import { issueOtp, type OtpPurpose } from '../src/lib/otp'
import { sendOtpEmail, __setEmailAdapterForTesting, type EmailAdapter, type EmailMessage } from '../src/lib/email'

const prisma = new PrismaClient()

const PURPOSE: OtpPurpose = 'EMAIL_VERIFICATION'

class CountingEmailAdapter implements EmailAdapter {
  sendCount = 0
  subjects: string[] = []

  async send(message: EmailMessage): Promise<void> {
    this.sendCount++
    this.subjects.push(message.subject)
    // Do NOT actually send — just count. This is the test seam.
  }
}

interface DResult {
  scenario: string
  issued: number
  cooldown: number
  sendCount: number
  pass: boolean
  detail?: string
}

async function runD1(userId: string, adapter: CountingEmailAdapter): Promise<DResult> {
  // D1 — 10 concurrent resend, no prior OTP.
  await prisma.otpCode.deleteMany({ where: { userId, purpose: PURPOSE } })
  adapter.sendCount = 0
  adapter.subjects = []

  const N = 10
  const outcomes = await Promise.all(
    Array.from({ length: N }, async () => {
      const outcome = await issueOtp({ userId, purpose: PURPOSE })
      if (outcome.result === 'ISSUED') {
        await sendOtpEmail('qa-v2-verify@example.com', outcome.code, 'QA Verify')
      }
      return outcome.result
    })
  )
  const issued = outcomes.filter((r) => r === 'ISSUED').length
  const cooldown = outcomes.filter((r) => r === 'COOLDOWN').length
  const pass = issued === 1 && cooldown === N - 1 && adapter.sendCount === 1
  return {
    scenario: 'D1',
    issued,
    cooldown,
    sendCount: adapter.sendCount,
    pass,
    detail: pass
      ? undefined
      : `expected 1 ISSUED + 9 COOLDOWN + 1 send; got ${issued}/${cooldown}/${adapter.sendCount}`,
  }
}

async function runD2(userId: string, adapter: CountingEmailAdapter): Promise<DResult> {
  // D2 — 10 concurrent resend with prior OTP older than 60s.
  await prisma.otpCode.deleteMany({ where: { userId, purpose: PURPOSE } })
  // Insert an old challenge directly (bypass issueOtp to control lastSentAt).
  await prisma.otpCode.create({
    data: {
      userId,
      purpose: PURPOSE,
      codeHash: 'dummy-hash-old-' + Date.now(),
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      consumedAt: null,
      lastSentAt: new Date(Date.now() - 90_000), // 90s ago — past cooldown
    },
  })
  adapter.sendCount = 0
  adapter.subjects = []

  const N = 10
  const outcomes = await Promise.all(
    Array.from({ length: N }, async () => {
      const outcome = await issueOtp({ userId, purpose: PURPOSE })
      if (outcome.result === 'ISSUED') {
        await sendOtpEmail('qa-v2-verify@example.com', outcome.code, 'QA Verify')
      }
      return outcome.result
    })
  )
  const issued = outcomes.filter((r) => r === 'ISSUED').length
  const cooldown = outcomes.filter((r) => r === 'COOLDOWN').length
  const pass = issued === 1 && cooldown === N - 1 && adapter.sendCount === 1
  return {
    scenario: 'D2',
    issued,
    cooldown,
    sendCount: adapter.sendCount,
    pass,
    detail: pass
      ? undefined
      : `expected 1 ISSUED + 9 COOLDOWN + 1 send; got ${issued}/${cooldown}/${adapter.sendCount}`,
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('REFUSING TO RUN QA IN PRODUCTION — would mutate data.')
    process.exit(1)
  }

  console.log('=== QA Test 2-D: Email-send ownership under concurrent resend ===')
  console.log('')

  const user = await prisma.user.findUnique({
    where: { email: 'qa-v2-verify@example.com' },
    select: { id: true },
  })
  if (!user) throw new Error('QA user not found — run seed-qa first')

  // Install the counting adapter via the test seam.
  const adapter = new CountingEmailAdapter()
  __setEmailAdapterForTesting(adapter)
  console.log('[setup] CountingEmailAdapter installed via __setEmailAdapterForTesting ✅')

  try {
    // ==================================================================
    // D1 — single shot
    // ==================================================================
    console.log('\n--- D1: 10 concurrent resend, no prior OTP ---')
    const d1 = await runD1(user.id, adapter)
    console.log(
      `[D1] issued=${d1.issued}, cooldown=${d1.cooldown}, sendCount=${d1.sendCount}`
    )
    console.log(`[D1] RESULT: ${d1.pass ? 'PASS ✅' : 'FAIL ❌'}${d1.detail ? ' — ' + d1.detail : ''}`)

    // ==================================================================
    // D2 — single shot
    // ==================================================================
    console.log('\n--- D2: 10 concurrent resend with prior OTP >60s old ---')
    const d2 = await runD2(user.id, adapter)
    console.log(
      `[D2] issued=${d2.issued}, cooldown=${d2.cooldown}, sendCount=${d2.sendCount}`
    )
    console.log(`[D2] RESULT: ${d2.pass ? 'PASS ✅' : 'FAIL ❌'}${d2.detail ? ' — ' + d2.detail : ''}`)

    // ==================================================================
    // D3 — 5 iterations of D1 + D2
    // ==================================================================
    console.log('\n--- D3: 5-iteration stress of D1 + D2 ---')
    const ITER = 5
    let d1Fails = 0
    let d2Fails = 0
    let maxSendCount = 0
    for (let i = 0; i < ITER; i++) {
      const r1 = await runD1(user.id, adapter)
      if (!r1.pass) d1Fails++
      maxSendCount = Math.max(maxSendCount, r1.sendCount)
      const r2 = await runD2(user.id, adapter)
      if (!r2.pass) d2Fails++
      maxSendCount = Math.max(maxSendCount, r2.sendCount)
    }
    console.log(
      `[D3] D1: ${ITER - d1Fails}/${ITER} passed; D2: ${ITER - d2Fails}/${ITER} passed; ` +
        `max sendCount observed = ${maxSendCount} (expected 1)`
    )
    const d3Pass = d1Fails === 0 && d2Fails === 0 && maxSendCount === 1
    console.log(`[D3] RESULT: ${d3Pass ? 'PASS ✅' : 'FAIL ❌'}`)

    // ==================================================================
    // SUMMARY
    // ==================================================================
    console.log('\n--- SUMMARY ---')
    console.log(`D1 (single shot):                 ${d1.pass ? 'PASS ✅' : 'FAIL ❌'}`)
    console.log(`D2 (single shot):                 ${d2.pass ? 'PASS ✅' : 'FAIL ❌'}`)
    console.log(`D3 (5 iterations of D1+D2):       ${d3Pass ? 'PASS ✅' : 'FAIL ❌'}`)
    console.log('')
    console.log('Email-send invariant: "sendOtpEmail called EXACTLY ONCE per 10-concurrent burst"')

    const overallPass = d1.pass && d2.pass && d3Pass
    console.log(`\nOVERALL: ${overallPass ? 'PASS ✅' : 'FAIL ❌'}`)
    if (!overallPass) process.exit(1)
  } finally {
    // Reset the email adapter to the factory default.
    __setEmailAdapterForTesting(null)
    console.log('\n[teardown] Email adapter reset to factory default.')
  }
}

main()
  .catch((e) => {
    console.error('QA Test 2-D FAILED:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
