/**
 * One-off DB update: change the hero eyebrow text from
 * "Suplemen Rekomendasi Dokter Hewan" to "Selamat datang di Anima Club"
 * on the live SiteSetting singleton row.
 *
 * Source code's heroEyebrow default in prisma/schema.prisma was already
 * "Suplemen & Vitamin Hewan Peliharaan" — but the live DB row was
 * customized via the Admin UI to a different value. Updating the schema
 * default alone is not enough — the live row's heroEyebrow column holds
 * the OLD value.
 *
 * This script patches ONLY the singleton row's heroEyebrow field.
 *
 * Usage:
 *   DATABASE_URL="..." DIRECT_URL="..." \
 *   bun run scripts/update-hero-eyebrow.ts           # dry-run (default)
 *   bun run scripts/update-hero-eyebrow.ts --apply    # write
 */
import { PrismaClient } from '@prisma/client'

const args = new Set(process.argv.slice(2))
const APPLY = args.has('--apply')

const prisma = new PrismaClient({ log: [{ level: 'error', emit: 'stdout' }] })

const NEW_HERO_EYEBROW = 'Selamat datang di Anima Club'

async function main() {
  console.log(`=== MODE: ${APPLY ? 'APPLY (writes to DB)' : 'DRY-RUN (no writes; pass --apply to write)'} ===`)

  const current = await prisma.siteSetting.findUnique({ where: { id: 'singleton' } })
  if (!current) {
    console.log('No singleton row found. Nothing to update.')
    return
  }

  console.log(`\nCurrent heroEyebrow: "${current.heroEyebrow}"`)
  console.log(`New heroEyebrow     : "${NEW_HERO_EYEBROW}"`)

  if (current.heroEyebrow === NEW_HERO_EYEBROW) {
    console.log('\nNo diff — singleton row already has the new value. Nothing to do.')
    return
  }

  if (!APPLY) {
    console.log('\nDry-run complete. Re-run with --apply to write.')
    return
  }

  await prisma.siteSetting.update({
    where: { id: 'singleton' },
    data: { heroEyebrow: NEW_HERO_EYEBROW },
  })
  console.log(`\nApplied heroEyebrow update to the singleton row.`)
}

main()
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
