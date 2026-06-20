/**
 * Convert all PNG images in /public to WebP — much smaller, same quality.
 *
 * Why this matters:
 * - PNG files: 28-60 KB each, 442 KB total homepage
 * - WebP lossy q=80: ~30-50% smaller, visually identical
 * - WebP lossy q=80 on photos: ~70-80% smaller than PNG
 *
 * On mobile Indonesia (4G, 5 Mbps):
 * - PNG: 442 KB / 5 Mbps = 700ms theoretical, ~2s with RTT
 * - WebP: ~150 KB / 5 Mbps = 240ms theoretical, ~800ms with RTT
 *
 * Usage: bun scripts/convert-to-webp.ts
 */
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const PUBLIC_DIR = '/home/z/my-project/public'

type Item = {
  input: string
  output: string
  width?: number  // optional resize
  quality: number
}

const items: Item[] = [
  // Hero — resize to max 1280 wide (was 1344), quality 78
  {
    input: path.join(PUBLIC_DIR, 'hero-pets.png'),
    output: path.join(PUBLIC_DIR, 'hero-pets.webp'),
    width: 1280,
    quality: 78,
  },
  // Product images — resize to 800x800 (was 1024), quality 78
  ...fs
    .readdirSync(path.join(PUBLIC_DIR, 'products'))
    .filter((f) => f.endsWith('.png'))
    .map((f) => ({
      input: path.join(PUBLIC_DIR, 'products', f),
      output: path.join(PUBLIC_DIR, 'products', f.replace('.png', '.webp')),
      width: 800,
      quality: 78,
    })),
]

async function main() {
  console.log('🔄 Converting PNG → WebP...\n')

  let totalBefore = 0
  let totalAfter = 0

  for (const item of items) {
    const beforeStat = fs.statSync(item.input)
    const beforeKB = beforeStat.size / 1024

    let pipeline = sharp(item.input)
    if (item.width) {
      pipeline = pipeline.resize({ width: item.width, withoutEnlargement: true })
    }
    pipeline = pipeline.webp({ quality: item.quality, effort: 4 })

    await pipeline.toFile(item.output)

    const afterStat = fs.statSync(item.output)
    const afterKB = afterStat.size / 1024
    const reduction = ((1 - afterKB / beforeKB) * 100).toFixed(0)

    totalBefore += beforeKB
    totalAfter += afterKB

    const name = path.basename(item.input)
    console.log(
      `  ${name.padEnd(35)} ${beforeKB.toFixed(1).padStart(6)} KB → ${afterKB
        .toFixed(1)
        .padStart(6)} KB  (-${reduction}%)`
    )
  }

  console.log('')
  console.log(
    `  ${'TOTAL'.padEnd(35)} ${totalBefore.toFixed(1).padStart(6)} KB → ${totalAfter
      .toFixed(1)
      .padStart(6)} KB  (-${(((1 - totalAfter / totalBefore) * 100)).toFixed(0)}%)`
  )
  console.log(`\n✅ Done. WebP files saved alongside original PNGs.`)
  console.log(`   PNG files kept as fallback for old browsers.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
