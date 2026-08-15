/**
 * scripts/bootstrap-developer.ts
 * ============================================================================
 * Admin Realm V1 — Production Developer Bootstrap (one-purpose, idempotent).
 * ============================================================================
 *
 * PURPOSE:
 *   Create the FIRST DEVELOPER AdminUser in a fresh production database.
 *   This is the ONLY supported way to materialize a DEVELOPER account in
 *   production — the /api/admin/users POST route (Stage 3) hardcodes
 *   systemRole='ADMIN' and rejects any client-supplied DEVELOPER role.
 *
 * WHY THIS EXISTS (and `bun run seed` does NOT replace it):
 *   `prisma/seed.ts` unconditionally runs `deleteMany()` on every business
 *   table (User, Order, Product, Cart, Review, Voucher, ...) before
 *   re-seeding catalog data. Running it against production WIPES all
 *   customers, orders, and products. This script is the safe, one-purpose
 *   alternative that ONLY touches the AdminUser table and ONLY creates a
 *   single row.
 *
 * CONTRACT:
 *   - Reads THREE env vars: DEVELOPER_USERNAME, DEVELOPER_PASSWORD,
 *     DEVELOPER_DISPLAY_NAME (optional, defaults to "Developer").
 *   - bcrypt-hashes the password (cost 10, matching seed.ts convention).
 *   - Idempotent: if an AdminUser with DEVELOPER_USERNAME already exists,
 *     the script EXITS 0 without modifying ANY field. The operator's
 *     later password changes via /admin/change-password are preserved.
 *   - NEVER overwrites an existing developer.
 *   - NEVER touches User / Order / Product / Cart / Review / Voucher /
 *     AdminPermission / any other table.
 *   - NEVER logs the password (not even its length or hash).
 *   - Refuses to run if DEVELOPER_USERNAME or DEVELOPER_PASSWORD is empty.
 *   - Refuses to silently PROMOTE an existing ADMIN to DEVELOPER — if an
 *     AdminUser with the username exists but systemRole != 'DEVELOPER',
 *     the script aborts with a non-zero exit code.
 *   - Creates exactly ONE row with:
 *       systemRole         = 'DEVELOPER'
 *       isActive           = true
 *       mustChangePassword = false  (operator chose the password at bootstrap)
 *       sessionVersion     = 0
 *       createdByAdminId   = null   (the bootstrap developer has no creator)
 *
 * USAGE (production):
 *   # 1. Set env vars (do NOT persist them in shell history):
 *   export DEVELOPER_USERNAME="your-username"
 *   export DEVELOPER_PASSWORD="your-strong-password"
 *   export DEVELOPER_DISPLAY_NAME="Your Name"   # optional
 *
 *   # 2. Ensure DATABASE_URL points at the production Neon pooled endpoint.
 *   # 3. Run:
 *   bun run scripts/bootstrap-developer.ts
 *
 *   # 4. Unset the password env var immediately after success:
 *   unset DEVELOPER_PASSWORD
 *
 * EXIT CODES:
 *   0 — developer created, OR developer already existed (idempotent skip)
 *   1 — env vars missing / invalid
 *   2 — an AdminUser with the username exists but is NOT a DEVELOPER
 *       (refusing silent promotion — resolve manually)
 *   3 — unexpected DB error
 * ============================================================================
 */

import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function bootstrapDeveloperAdmin(): Promise<number> {
  const username = process.env.DEVELOPER_USERNAME?.trim().toLowerCase()
  const password = process.env.DEVELOPER_PASSWORD
  const displayName = process.env.DEVELOPER_DISPLAY_NAME?.trim() || 'Developer'

  // ----- 1. Validate env vars (no defaults for credentials) -----
  if (!username) {
    console.error('❌ DEVELOPER_USERNAME is missing or empty.')
    console.error('   Set it and re-run. No DB writes were performed.')
    return 1
  }
  if (!password) {
    console.error('❌ DEVELOPER_PASSWORD is missing or empty.')
    console.error('   Set it and re-run. No DB writes were performed.')
    return 1
  }
  if (password.length < 8) {
    console.error('❌ DEVELOPER_PASSWORD is shorter than 8 characters.')
    console.error('   Choose a stronger password. No DB writes were performed.')
    return 1
  }

  console.log('🔐 Bootstrapping DEVELOPER AdminUser...')
  console.log(`   username:     ${username}`)
  console.log(`   displayName:  ${displayName}`)
  console.log(`   systemRole:   DEVELOPER`)
  console.log(`   (password is NOT logged)`)

  try {
    // ----- 2. Idempotency check -----
    // If an AdminUser with this username already exists, do NOT touch any
    // field. The operator may have changed the password via
    // /admin/change-password, may have changed the display name via the
    // developer UI, etc. Re-running this script must never clobber those
    // changes.
    const existing = await db.adminUser.findUnique({ where: { username } })
    if (existing) {
      if (existing.systemRole !== 'DEVELOPER') {
        // Refuse to silently promote an ADMIN → DEVELOPER. That is a
        // security-sensitive action and must be done deliberately via
        // psql/Prisma Studio by the operator, not by this bootstrap tool.
        console.error(
          `❌ An AdminUser with username "${username}" already exists but has systemRole="${existing.systemRole}" (not DEVELOPER).`
        )
        console.error(
          '   Refusing to silently promote. If this is intentional, resolve it manually via psql.'
        )
        return 2
      }
      console.log(
        `✅ DEVELOPER AdminUser already exists (username=${username}) — bootstrap skipped (idempotent).`
      )
      console.log('   No fields were modified. No other tables were touched.')
      return 0
    }

    // ----- 3. Create the developer (the ONLY write path in this script) -----
    const passwordHash = await bcrypt.hash(password, 10)
    await db.adminUser.create({
      data: {
        username,
        passwordHash,
        displayName,
        systemRole: 'DEVELOPER',
        isActive: true,
        mustChangePassword: false, // operator chose the password at bootstrap
        sessionVersion: 0,
        // createdByAdminId is null — the bootstrap developer has no creator.
      },
    })
    console.log(`✅ DEVELOPER AdminUser created (username=${username}).`)
    console.log('   No other tables were touched.')
    console.log('')
    console.log('   Next steps:')
    console.log('   1. Unset DEVELOPER_PASSWORD from your shell.')
    console.log('   2. Sign in at /admin/login with the username + password.')
    console.log('   3. (Optional) Change the password via /admin/change-password.')
    return 0
  } catch (err) {
    console.error('❌ Unexpected error while bootstrapping DEVELOPER AdminUser:')
    console.error(err)
    return 3
  }
}

// ----- Entry point -----
bootstrapDeveloperAdmin()
  .then((code) => {
    // Always disconnect before exiting — do not leak the Prisma client.
    return db.$disconnect().then(() => process.exit(code))
  })
  .catch(async (err) => {
    console.error('❌ Uncaught error in bootstrap-developer:')
    console.error(err)
    try {
      await db.$disconnect()
    } catch {
      // ignore disconnect errors during fatal exit
    }
    process.exit(3)
  })
