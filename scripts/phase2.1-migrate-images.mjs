// Phase 2.1 — Step 2: Download all ProductImage URLs from Neon to local .webp
// Source of truth: Neon DB (NOT seed, NOT web search).
// For each product, images are sorted by `order` ASC and saved as 01.webp, 02.webp, ...
// Aspect ratio preserved (no forced crop). Re-encode only when source is not WebP.

import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { mkdir, writeFile, stat, rm } from 'fs/promises';
import sharp from 'sharp';

loadEnv({ path: resolve(process.cwd(), '.env'), override: true });

const prisma = new PrismaClient({ log: ['error'] });

const PUBLIC_PRODUCTS = resolve(process.cwd(), 'public/products');

const FETCH_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

async function fetchWithRetry(url, attempt = 1) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'anima-companion-migration/2.1 (+https://animacompanion.id)' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return buf;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      console.warn(`  ⚠ fetch attempt ${attempt} failed (${err.message}); retrying...`);
      await new Promise(r => setTimeout(r, 1000 * attempt));
      return fetchWithRetry(url, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
}

function pad2(n) {
  return String(n + 1).padStart(2, '0'); // order=0 → "01"
}

async function processImage(img, slug) {
  const targetDir = resolve(PUBLIC_PRODUCTS, slug);
  await mkdir(targetDir, { recursive: true });

  const filename = `${pad2(img.order)}.webp`;
  const targetPath = resolve(targetDir, filename);
  const publicPath = `/products/${slug}/${filename}`;

  // Download
  const rawBuf = await fetchWithRetry(img.url);

  // Inspect format
  const meta = await sharp(rawBuf).metadata();
  const fmt = meta.format; // 'webp' | 'png' | 'jpeg' | 'gif' | ...

  let outBuf;
  if (fmt === 'webp') {
    // Already WebP — save as-is to avoid quality loss from re-encoding
    outBuf = rawBuf;
  } else {
    // Re-encode to WebP (preserve aspect ratio — no resize, no crop)
    outBuf = await sharp(rawBuf, { animated: false })
      .webp({ quality: 82, effort: 4, lossless: false })
      .toBuffer();
  }

  await writeFile(targetPath, outBuf);
  const st = await stat(targetPath);

  return {
    id: img.id,
    productId: img.productId,
    order: img.order,
    sourceUrl: img.url,
    sourceFormat: fmt,
    sourceWidth: meta.width,
    sourceHeight: meta.height,
    savedPath: targetPath,
    savedPublicPath: publicPath,
    savedBytes: st.size,
    reEncoded: fmt !== 'webp',
  };
}

async function main() {
  console.log('=== Phase 2.1 — Step 2: Download remote images → local .webp ===\n');

  await mkdir(PUBLIC_PRODUCTS, { recursive: true });

  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, slug: true,
      images: {
        orderBy: { order: 'asc' },
        select: { id: true, productId: true, url: true, alt: true, order: true },
      },
    },
  });

  console.log(`Found ${products.length} products, ${products.reduce((s, p) => s + p.images.length, 0)} images.\n`);

  const results = [];
  const failures = [];

  for (const p of products) {
    console.log(`\n• ${p.name}  [${p.slug}]  (${p.images.length} image${p.images.length === 1 ? '' : 's'})`);
    for (const img of p.images) {
      try {
        const r = await processImage(img, p.slug);
        console.log(`  ✓ order=${r.order}  ${r.sourceFormat.padEnd(5)} → ${r.savedPublicPath}  (${(r.savedBytes / 1024).toFixed(1)} KB)${r.reEncoded ? '  [re-encoded]' : ''}`);
        results.push(r);
      } catch (err) {
        console.error(`  ✗ order=${img.order}  FAILED: ${err.message}`);
        failures.push({ productId: p.id, slug: p.slug, imageId: img.id, order: img.order, url: img.url, error: err.message });
      }
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Downloaded & saved: ${results.length}/${results.length + failures.length}`);
  if (failures.length) {
    console.log(`Failures: ${failures.length}`);
    for (const f of failures) {
      console.log(`  - ${f.slug} order=${f.order} (${f.imageId}): ${f.error}`);
    }
  }

  const totalBytes = results.reduce((s, r) => s + r.savedBytes, 0);
  console.log(`Total static asset size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

  // Save results for the next step (DB update)
  const outPath = resolve(process.cwd(), 'scripts/phase2.1-migration-results.json');
  await writeFile(outPath, JSON.stringify({ results, failures }, null, 2));
  console.log(`\nResults saved → ${outPath}`);

  if (failures.length > 0) {
    process.exitCode = 2; // signal partial failure
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
