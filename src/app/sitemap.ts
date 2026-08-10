import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { db } from "@/lib/db";

// /sitemap.xml — generated dynamically from DB.
// Static routes are listed first, then dynamic product & problem slugs.

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Static public routes — only include SEO-indexable pages.
  // Cart/checkout/login/register/profile/orders/wishlist/admin are noindex.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/produk`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/tentang`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/kontak`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/problem`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
  ]

  // Dynamic product routes
  let productRoutes: MetadataRoute.Sitemap = []
  try {
    const products = await db.product.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    })
    productRoutes = products.map((p) => ({
      url: `${SITE_URL}/produk/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }))
  } catch (e) {
    // If DB is unreachable at build time, fall back to static routes only.
    console.error("[sitemap] Could not fetch products:", e)
  }

  // Dynamic problem routes
  let problemRoutes: MetadataRoute.Sitemap = []
  try {
    const problems = await db.problem.findMany({
      select: { slug: true, name: true },
    })
    problemRoutes = problems.map((p) => ({
      url: `${SITE_URL}/problem/${p.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    }))
  } catch (e) {
    console.error("[sitemap] Could not fetch problems:", e)
  }

  return [...staticRoutes, ...productRoutes, ...problemRoutes]
}
