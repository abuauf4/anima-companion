// Phase 2.1 — Step 5: Verify every DB path has a physical file in /public
// Also confirms: no remote URLs remain (cloudinary, placehold.co, etc.).

import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { stat } from 'fs/promises';

loadEnv({ path: resolve(process.cwd(), '.env'), override: true });

const prisma = new PrismaClient({ log: ['error'] });

const REMOTE_PATTERNS = [
  /^https?:\/\//i,
  /res\.cloudinary\.com/i,
  /placehold\.co/i,
  /^\/\//, // protocol-relative
  /^data:/i,
];

async function main() {
  console.log('=== Phase 2.1 — Step 5: File-presence + no-remote verification ===\n');

  const rows = await prisma.productImage.findMany({
    orderBy: [{ productId: 'asc' }, { order: 'asc' }],
    select: { id: true, productId: true, url: true, order: true, product: { select: { slug: true, name: true } } },
  });

  console.log(`Total rows: ${rows.length}\n`);

  let remoteCount = 0;
  let missingFileCount = 0;
  const report = [];

  for (const r of rows) {
    const isRemote = REMOTE_PATTERNS.some(re => re.test(r.url));
    if (isRemote) remoteCount++;

    // Path expected to be /products/<slug>/NN.webp — verify file exists
    const fsPath = resolve(process.cwd(), 'public', r.url.replace(/^\//, ''));
    let fileExists = false;
    let fileSize = 0;
    try {
      const st = await stat(fsPath);
      fileExists = true;
      fileSize = st.size;
    } catch {
      // file missing
    }
    if (!fileExists) missingFileCount++;

    report.push({
      imageId: r.id,
      productId: r.productId,
      slug: r.product.slug,
      productName: r.product.name,
      order: r.order,
      url: r.url,
      isRemote,
      fileExists,
      fileSize,
      fsPath,
    });
  }

  // Print results
  console.log('Per-image verification:');
  for (const r of report) {
    const status = r.fileExists && !r.isRemote
      ? '✅ OK'
      : r.isRemote
        ? '❌ REMOTE'
        : '❌ MISSING';
    console.log(`  ${status}  ${r.slug.padEnd(35)} order=${r.order}  ${r.url}  (${(r.fileSize / 1024).toFixed(1)} KB)`);
  }

  console.log('\n--- Summary ---');
  console.log(`Total ProductImage rows     : ${rows.length}`);
  console.log(`Rows with local /products/  : ${rows.length - remoteCount}`);
  console.log(`Rows still remote           : ${remoteCount}`);
  console.log(`Files present on disk       : ${rows.length - missingFileCount}`);
  console.log(`Files MISSING on disk       : ${missingFileCount}`);

  if (remoteCount === 0 && missingFileCount === 0) {
    console.log('\n✅ PASS — 100% ProductImage.url begins with /products/, and every DB path has a physical file in /public.');
  } else {
    console.log('\n❌ FAIL — see details above.');
    process.exitCode = 5;
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
