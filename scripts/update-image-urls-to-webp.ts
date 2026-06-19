/**
 * Update DB: ganti semua image URL .png → .webp
 * - Banner hero: /hero-pets.png → /hero-pets.webp
 * - Product images: /products/{slug}.png → /products/{slug}.webp
 */
import { db } from '../src/lib/db'

async function main() {
  console.log('🔄 Update image URL .png → .webp di DB...\n')

  // Update banner hero
  const bannerResult = await db.banner.updateMany({
    where: { imageUrl: { contains: '.png' } },
    data: { imageUrl: { set: '/hero-pets.webp' } },
  })
  console.log(`✅ Banner diupdate: ${bannerResult.count} row`)

  // Ambil semua product images yang .png
  const images = await db.productImage.findMany({
    where: { url: { contains: '.png' } },
  })
  console.log(`📦 Product images ditemukan: ${images.length}`)

  // Update satu-satu
  for (const img of images) {
    const newUrl = img.url.replace(/\.png$/, '.webp')
    await db.productImage.update({
      where: { id: img.id },
      data: { url: newUrl },
    })
    console.log(`  ${img.url} → ${newUrl}`)
  }

  // Cek hasil
  const remaining = await db.productImage.findMany({
    where: { url: { contains: '.png' } },
  })
  console.log(`\n✅ Sisa .png URL di DB: ${remaining.length}`)

  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
