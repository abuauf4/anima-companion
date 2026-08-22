/**
 * One-off DB update: patch the live SiteSetting singleton row to reflect
 * the new brand contact info (400+ clinics, Gedung STP - IPB address,
 * sutanvetmedika@gmail.com email).
 *
 * Source code defaults in prisma/schema.prisma were already updated in the
 * same commit, but the singleton row already exists in the DB (created
 * earlier with the old defaults), so updating the schema defaults alone
 * is not enough — the live row's columns hold the OLD values.
 *
 * This script patches ONLY the singleton row's affected fields:
 *   - heroDescription     (515+ → 400+)
 *   - trustBadge2Value    (515+ → 400+)
 *   - email               (hello@animacompanion.id → sutanvetmedika@gmail.com)
 *
 * It does NOT touch:
 *   - any other SiteSetting field
 *   - any other model/table
 *   - the schema (no migration)
 *
 * Idempotent: safe to re-run.
 *
 * Usage:
 *   DATABASE_URL="..." DIRECT_URL="..." \
 *   bun run scripts/update-brand-contact.ts           # dry-run (default)
 *   bun run scripts/update-brand-contact.ts --apply   # write
 */
import { PrismaClient } from '@prisma/client'

const args = new Set(process.argv.slice(2))
const APPLY = args.has('--apply')

const prisma = new PrismaClient({ log: [{ level: 'error', emit: 'stdout' }] })

const NEW_VALUES = {
  heroDescription:
    'Suplemen & vitamin hewan peliharaan premium dari Anima Companion — PT Sutan Vet Medika. Tersedia di 400+ klinik seluruh Indonesia.',
  trustBadge2Value: '400+',
  email: 'sutanvetmedika@gmail.com',
} as const

async function main() {
  console.log(`=== MODE: ${APPLY ? 'APPLY (writes to DB)' : 'DRY-RUN (no writes; pass --apply to write)'} ===`)

  const current = await prisma.siteSetting.findUnique({ where: { id: 'singleton' } })
  if (!current) {
    console.log('No singleton row found. Nothing to update.')
    return
  }

  console.log('\nCurrent values:')
  console.log(`  heroDescription   : ${current.heroDescription}`)
  console.log(`  trustBadge2Value  : ${current.trustBadge2Value}`)
  console.log(`  email             : ${current.email}`)

  const diffs: Array<{ field: string; from: string; to: string }> = []
  if (current.heroDescription !== NEW_VALUES.heroDescription) {
    diffs.push({ field: 'heroDescription', from: current.heroDescription, to: NEW_VALUES.heroDescription })
  }
  if (current.trustBadge2Value !== NEW_VALUES.trustBadge2Value) {
    diffs.push({ field: 'trustBadge2Value', from: current.trustBadge2Value, to: NEW_VALUES.trustBadge2Value })
  }
  if (current.email !== NEW_VALUES.email) {
    diffs.push({ field: 'email', from: current.email, to: NEW_VALUES.email })
  }

  if (diffs.length === 0) {
    console.log('\nNo diffs — singleton row already has the new values. Nothing to do.')
    return
  }

  console.log('\nDiffs:')
  for (const d of diffs) {
    console.log(`  [${APPLY ? 'UPDATE' : 'DRY  '}] ${d.field}: "${d.from}" → "${d.to}"`)
  }

  if (!APPLY) {
    console.log('\nDry-run complete. Re-run with --apply to write.')
    return
  }

  // Apply — only the 3 fields that differ.
  const data: Record<string, string> = {}
  for (const d of diffs) data[d.field] = d.to
  await prisma.siteSetting.update({ where: { id: 'singleton' }, data })
  console.log(`\nApplied ${diffs.length} field update(s) to the singleton row.`)
}

main()
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
