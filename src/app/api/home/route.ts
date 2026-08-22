import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cached } from '@/lib/cache'

const PRODUCT_INCLUDE = {
  images: { take: 1, orderBy: { order: 'asc' } },
  category: true,
  problems: { include: { problem: true } },
  petTypes: { include: { petType: true } },
  seller: { select: { id: true, name: true, slug: true, isVerified: true } },
  // Variants — only active variants, only the price-relevant fields.
  // The homepage card needs to know if a product has variants (to show
  // "Mulai Rp..." prefix) but doesn't need the full variant selector
  // data — that's loaded on the detail page. Keeping this lean avoids
  // bloating the home bundle (which is cached for 60s and serves all
  // homepage visitors).
  variants: {
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, price: true, salePrice: true, stock: true, sortOrder: true },
  },
} as const

/**
 * GET /api/home
 * Single bundled endpoint for homepage — returns all data needed
 * (banners, bestSellers, newProducts, problems,
 *  testimonials, petTypes, settings, faqs)
 * in ONE round trip to the database instead of many.
 *
 * The promo campaign (configurable countdown bar above navbar) lives
 * inside `settings.promoActive / promoStartAt / promoEndAt / promoCountdown /
 * promoTextBefore / promoTextDuring / promoTitle / promoLink`. The state
 * machine (before/during/after) + live countdown are computed client-side
 * in AnnouncementBar from the absolute UTC timestamps — the server does NOT
 * pre-compute "now" because the cached response may be 60s stale.
 *
 * Cached for 60s to absorb traffic spikes and reduce pool usage.
 */
export async function GET() {
  try {
    // Quick env sanity check — fail fast with helpful message if Vercel env vars missing
    if (!process.env.DATABASE_URL) {
      console.error('[/api/home] DATABASE_URL not set. Set it in Vercel → Settings → Environment Variables.')
      return NextResponse.json(
        {
          error: 'Database not configured',
          hint: 'Ask admin to set DATABASE_URL env var in Vercel dashboard.',
          docs: 'See VERCEL_SETUP.md',
        },
        { status: 500 }
      )
    }

    const data = await cached('home:all', 60_000, async () => {
      const [
        banners,
        bestSellers,
        newProducts,
        problems,
        testimonials,
        petTypes,
        faqs,
        settingsRow,
      ] = await Promise.all([
        db.banner.findMany({
          where: { isActive: true },
          orderBy: { order: 'asc' },
        }),
        db.product.findMany({
          where: { isActive: true, isBestSeller: true },
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: PRODUCT_INCLUDE,
        }),
        db.product.findMany({
          where: { isActive: true, isNew: true },
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: PRODUCT_INCLUDE,
        }),
        db.problem.findMany({
          orderBy: { name: 'asc' },
          include: { _count: { select: { products: true } } },
        }),
        db.testimonial.findMany({
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 4,
        }),
        db.petType.findMany({
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: { products: { where: { product: { isActive: true } } } },
            },
          },
        }),
        db.fAQ.findMany({
          where: { isActive: true },
          orderBy: { order: 'asc' },
        }),
        // SiteSetting singleton — create on first access if missing
        db.siteSetting.upsert({
          where: { id: 'singleton' },
          create: { id: 'singleton' },
          update: {},
        }),
      ])

      // Sale countdown has been replaced by the configurable promo campaign
      // fields on SiteSetting (promoActive / promoStartAt / promoEndAt /
      // promoCountdown / promoTextBefore / promoTextDuring / promoTitle /
      // promoLink). The state machine (before/during/after) and the live
      // countdown are computed client-side in AnnouncementBar from the
      // absolute UTC timestamps — see src/components/layout/AnnouncementBar.tsx.
      //
      // `settingsRow` already contains all 8 promo* fields (it's the full
      // SiteSetting row), so no extra projection is needed here.
      return {
        banners,
        bestSellers,
        newProducts,
        problems,
        testimonials,
        petTypes,
        faqs,
        settings: settingsRow,
      }
    })

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (err) {
    console.error('[/api/home] ERROR:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'
    let hint = 'Check server logs.'

    if (message.includes('DATABASE_URL') || message.includes('url must start with')) {
      hint = 'DATABASE_URL is missing or invalid. Set it in Vercel → Settings → Environment Variables. See VERCEL_SETUP.md.'
    } else if (message.includes('EMAXCONNSESSION') || message.includes('pool_size')) {
      hint = 'Supabase connection pool exhausted. Wait 30s and retry, or upgrade Supabase plan.'
    } else if (message.includes('Can\'t reach database server') || message.includes('P1001')) {
      hint = 'Cannot reach Supabase. Check if DATABASE_URL is correct and Supabase project is not paused.'
    } else if (message.includes('PrismaClient') || message.includes('prisma generate')) {
      hint = 'Prisma client not generated. Make sure "postinstall": "prisma generate" is in package.json and Vercel ran it during build.'
    }

    return NextResponse.json(
      { error: 'Failed to load homepage data', hint, detail: message },
      { status: 500 }
    )
  }
}
