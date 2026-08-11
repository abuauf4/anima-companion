// Phase 2.1 — Step 4: Update Neon ProductImage.url to local /products/ paths
// Preserves: id, productId, order, alt — only changes `url`.
// Reads results from Step 2 (scripts/phase2.1-migration-results.json).

import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { readFile, writeFile } from 'fs/promises';

loadEnv({ path: resolve(process.cwd(), '.env'), override: true });

const prisma = new PrismaClient({ log: ['error'] });

async function main() {
  console.log('=== Phase 2.1 — Step 4: Update Neon ProductImage.url → local paths ===\n');

  const resultsPath = resolve(process.cwd(), 'scripts/phase2.1-migration-results.json');
  const { results, failures } = JSON.parse(await readFile(resultsPath, 'utf8'));

  if (failures?.length > 0) {
    console.warn(`⚠ ${failures.length} images failed to download in Step 2 — they will NOT be updated.`);
  }

  if (!results || results.length === 0) {
    console.log('No images to update. Exiting.');
    return;
  }

  // Build update payload
  const updates = results.map(r => ({
    where: { id: r.id },
    data: { url: r.savedPublicPath },
    // captured for audit log
    productId: r.productId,
    order: r.order,
    beforeUrl: r.sourceUrl,
    afterUrl: r.savedPublicPath,
  }));

  // Run inside a transaction — all-or-nothing
  console.log(`Updating ${updates.length} ProductImage rows in Neon (transactional)...\n`);

  const txResult = await prisma.$transaction(
    updates.map(u =>
      prisma.productImage.update({
        where: { id: u.where.id },
        data: { url: u.data.url },
        select: { id: true, url: true, productId: true, order: true, alt: true },
      })
    )
  );

  console.log(`✓ Updated ${txResult.length} rows.`);
  console.log('\nSample (first 5):');
  txResult.slice(0, 5).forEach((r, i) => {
    console.log(`  ${i + 1}. id=${r.id.slice(0, 8)}..  order=${r.order}  url=${r.url}`);
  });

  // Save audit log of changes
  const auditLog = updates.map((u, i) => ({
    imageId: u.where.id,
    productId: u.productId,
    order: u.order,
    before: u.beforeUrl,
    after: u.afterUrl,
    rowAfterUpdate: txResult[i],
  }));
  const auditPath = resolve(process.cwd(), 'scripts/phase2.1-db-update-audit.json');
  await writeFile(auditPath, JSON.stringify(auditLog, null, 2));
  console.log(`\nAudit log saved → ${auditPath}`);

  // Verification: ensure NO ProductImage.url remains a remote URL
  const totalImages = await prisma.productImage.count();
  const localImages = await prisma.productImage.count({
    where: { url: { startsWith: '/products/' } },
  });
  const remoteImages = totalImages - localImages;

  console.log('\n--- Post-update verification ---');
  console.log(`Total ProductImage rows : ${totalImages}`);
  console.log(`Local /products/ rows    : ${localImages}`);
  console.log(`Remote dependency rows   : ${remoteImages}`);

  if (remoteImages > 0) {
    const offenders = await prisma.productImage.findMany({
      where: { NOT: { url: { startsWith: '/products/' } } },
      select: { id: true, productId: true, order: true, url: true },
    });
    console.log('\n⚠ Offending rows:');
    offenders.forEach(o => console.log(`  - id=${o.id}  productId=${o.productId}  url=${o.url}`));
    process.exitCode = 3;
  } else {
    console.log('\n✅ 100% ProductImage.url begins with /products/ — no remote dependency remains.');
  }

  // Verify IDs / productId / order / alt are unchanged
  console.log('\n--- Field preservation check (id, productId, order, alt) ---');
  let mismatches = 0;
  for (const u of updates) {
    const after = txResult.find(r => r.id === u.where.id);
    if (!after) { mismatches++; continue; }
    if (after.productId !== u.productId) {
      console.log(`⚠ productId changed for ${u.where.id}: ${u.productId} → ${after.productId}`);
      mismatches++;
    }
    if (after.order !== u.order) {
      console.log(`⚠ order changed for ${u.where.id}: ${u.order} → ${after.order}`);
      mismatches++;
    }
  }
  if (mismatches === 0) {
    console.log('✅ All id, productId, order preserved. Only url was changed.');
  } else {
    console.log(`⚠ ${mismatches} mismatch(es) detected.`);
    process.exitCode = 4;
  }
}

main()
  .catch(e => {
    console.error('FATAL:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
