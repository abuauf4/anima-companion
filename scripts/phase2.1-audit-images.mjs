// Phase 2.1 — Step 1: Audit all ProductImage rows in Neon
// Loads .env from project root, never echoes credentials.
// Reports: per-product image inventory + source classification (Cloudinary/local/other).

import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { writeFileSync } from 'fs';

// Load .env with override to beat any stale shell DATABASE_URL
loadEnv({ path: resolve(process.cwd(), '.env'), override: true });

const prisma = new PrismaClient({
  log: ['error'],
});

function classifyUrl(url) {
  if (!url) return 'EMPTY';
  if (url.includes('res.cloudinary.com')) return 'CLOUDINARY';
  if (url.startsWith('/products/')) return 'LOCAL_PRODUCTS';
  if (url.startsWith('/')) return 'LOCAL_OTHER';
  if (/^https?:\/\//.test(url)) return 'REMOTE_OTHER';
  return 'OTHER';
}

async function main() {
  console.log('=== Phase 2.1 — ProductImage Audit (Neon source of truth) ===\n');

  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      images: {
        orderBy: { order: 'asc' },
        select: { id: true, url: true, alt: true, order: true },
      },
    },
  });

  const report = {
    generatedAt: new Date().toISOString(),
    totalProducts: products.length,
    totalImages: 0,
    sourceBreakdown: {
      CLOUDINARY: 0,
      LOCAL_PRODUCTS: 0,
      LOCAL_OTHER: 0,
      REMOTE_OTHER: 0,
      EMPTY: 0,
      OTHER: 0,
    },
    products: [],
  };

  for (const p of products) {
    const imgs = p.images.map(img => ({
      id: img.id,
      order: img.order,
      url: img.url,
      alt: img.alt,
      source: classifyUrl(img.url),
    }));
    report.totalImages += imgs.length;
    for (const img of imgs) {
      report.sourceBreakdown[img.source] = (report.sourceBreakdown[img.source] || 0) + 1;
    }
    report.products.push({
      id: p.id,
      name: p.name,
      slug: p.slug,
      imageCount: imgs.length,
      images: imgs,
    });
  }

  // Console summary
  console.log(`Total products: ${report.totalProducts}`);
  console.log(`Total ProductImage rows: ${report.totalImages}`);
  console.log('\nSource breakdown:');
  for (const [src, n] of Object.entries(report.sourceBreakdown)) {
    console.log(`  ${src.padEnd(16)} ${n}`);
  }
  console.log('\nPer-product detail:');
  for (const p of report.products) {
    console.log(`\n• ${p.name}  [${p.slug}]  (${p.imageCount} image${p.imageCount === 1 ? '' : 's'})`);
    for (const img of p.images) {
      console.log(`    order=${img.order}  src=${img.source.padEnd(14)}  ${img.url}`);
    }
  }

  // Save full JSON report
  const outPath = resolve(process.cwd(), 'scripts/phase2.1-audit-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nFull JSON report saved → ${outPath}`);
}

main()
  .catch(e => {
    console.error('FATAL:', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
