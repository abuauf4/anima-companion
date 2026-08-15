/**
 * QA seed — creates dedicated QA users in the QA PostgreSQL database.
 *
 * DOES NOT touch production. Production DATABASE_URL is never loaded.
 *
 * Creates two QA users:
 *   - qa-v2-verify@example.com  — used by OTP verify / invalid-attempt tests
 *   - qa-v2-reset@example.com   — used by password-reset E2E test
 *
 * Idempotent: if the users already exist (by email), they're deleted and
 * recreated so each QA run starts from a known state.
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const QA_USERS = [
  {
    email: 'qa-v2-verify@example.com',
    name: 'QA Verify',
    password: 'qa-old-password-001',
    provider: 'PASSWORD' as const,
    emailVerifiedAt: null,
  },
  {
    email: 'qa-v2-reset@example.com',
    name: 'QA Reset',
    password: 'qa-old-password-002',
    provider: 'PASSWORD' as const,
    emailVerifiedAt: new Date(), // already verified — only password reset flow tested
  },
  {
    email: 'qa-v2-legacy@example.com',
    name: 'QA Legacy Session',
    password: 'qa-old-password-003',
    provider: 'PASSWORD' as const,
    emailVerifiedAt: new Date(),
    sessionVersion: 0, // explicitly v0 (default)
  },
]

async function main() {
  console.log('[QA seed] Connecting to QA database...')
  // Quick sanity check — confirm we're NOT pointing at production by checking
  // the database name. The QA database is `qa_db`. If this fails, abort.
  const dbName = await prisma.$queryRaw<{ datname: string }[]>`
    SELECT current_database() AS datname
  `
  const name = dbName[0]?.datname
  if (name !== 'qa_db') {
    throw new Error(
      `Refusing to seed: connected to database "${name}", expected "qa_db". ` +
        'Production data must never be touched by QA scripts.'
    )
  }
  console.log(`[QA seed] Confirmed QA database: ${name}`)

  for (const u of QA_USERS) {
    // Delete if exists (cascade removes OTP/grants/tokens)
    await prisma.user.deleteMany({ where: { email: u.email } })
    const hashed = await bcrypt.hash(u.password, 10)
    const created = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        password: hashed,
        provider: u.provider,
        emailVerifiedAt: u.emailVerifiedAt,
        sessionVersion: u.sessionVersion ?? 0,
      },
      select: { id: true, email: true, sessionVersion: true },
    })
    console.log(`[QA seed] Created ${created.email} (id=${created.id}, v${created.sessionVersion})`)
  }

  // Also clean up any stray OTP/grant rows from prior runs.
  await prisma.otpCode.deleteMany({})
  await prisma.passwordResetGrant.deleteMany({})
  console.log('[QA seed] Cleared OtpCode and PasswordResetGrant tables.')

  console.log('[QA seed] Done.')
}

main()
  .catch((e) => {
    console.error('[QA seed] FAILED:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
