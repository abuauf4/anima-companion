/**
 * SEO helpers for Anima Companion — central place for canonical URLs,
 * metadata builders, and JSON-LD structured data (Product / Organization / WebSite).
 *
 * Two independent env vars control SEO behavior (Phase 1.1):
 *
 * - `NEXT_PUBLIC_SITE_URL`  — official canonical production domain.
 *   MUST always be `https://animacompanion.id`, on every deployment
 *   (production, staging, preview, local). Never set this to a staging /
 *   preview / Vercel / Coolify / VPS-IP URL.
 *
 * - `NEXT_PUBLIC_ALLOW_INDEXING` — whether THIS deployment may be indexed.
 *   "true" → production only. Anything else (or unset) → staging/preview/local,
 *   forces noindex,nofollow sitewide and disallows all crawling in robots.txt.
 *
 * The two are intentionally DECOUPLED: canonical always points to the production
 * domain (so staging pages tell Google "the canonical is the production URL"),
 * but the staging deployment itself is never indexed or crawled. This is the
 * correct pattern per Google's documentation on canonical + noindex.
 */

import type { Metadata } from 'next'

/** Canonical site origin (no trailing slash). Always https://animacompanion.id. */
export const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL || 'https://animacompanion.id').replace(/\/$/, '')

/**
 * Whether this deployment may be indexed by search engines.
 * Decoupled from SITE_URL so canonical stays the production domain even on
 * staging, but staging is never crawled.
 *
 * Default: `false` (safe default — any deployment that forgets to set the
 * env var is treated as non-indexable, never the other way around).
 */
export const ALLOW_INDEXING = process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true'

/** Brand defaults pulled from existing site config so copy stays in sync. */
export const BRAND = {
  name: 'Anima Companion',
  legalName: 'PT Sutan Vet Medika',
  tagline: 'Elevating Animal Health',
  description:
    'Anima Companion (PT Sutan Vet Medika) — suplemen & vitamin hewan peliharaan premium. Produk Felcover+, Sioren, dan Forevet. Tersedia di 515+ klinik hewan seluruh Indonesia.',
  logoUrl: '/anima-logo.svg',
  ogImage: '/og-image.png',
  email: 'hello@animacompanion.id',
  phone: '+6282210846408',
  address: {
    street: '',
    city: 'Bogor',
    region: 'Jawa Barat',
    country: 'ID',
  },
  social: {
    instagram: 'https://instagram.com/anima.companion',
    shopee: 'https://shopee.co.id/anima.companion',
    tokopedia: 'https://www.tokopedia.com/find/felcover',
  },
  hours: 'Senin–Sabtu, 09.00–18.00 WIB',
}

/**
 * Build canonical URL for a path. Always absolute with SITE_URL origin.
 * @example canonicalFor('/produk')  → 'https://animacompanion.id/produk'
 */
export function canonicalFor(path: string = '/'): string {
  const p = path.startsWith('/') ? path : '/' + path
  return `${SITE_URL}${p === '/' ? '' : p}`
}

interface BuildMetadataOpts {
  title?: string
  description?: string
  /** Path on this site (e.g. '/produk/foo'). Defaults to '/' (home). */
  path?: string
  /** OG image path (defaults to brand OG image). */
  image?: string
  /** Override the title template's `default` */
  noIndex?: boolean
  /** Optional keywords */
  keywords?: string[]
}

/**
 * Build Next.js Metadata object for a page.
 *
 * Always sets:
 * - canonical URL (always points to production origin via SITE_URL)
 * - OpenGraph (title, description, url, siteName, locale, type, images)
 * - Twitter card (summary_large_image)
 *
 * Indexing is controlled by the global ALLOW_INDEXING flag (env-driven):
 * - When `NEXT_PUBLIC_ALLOW_INDEXING !== "true"` (staging/preview/local),
 *   `noIndex` is FORCED to `true` regardless of caller input, so every page
 *   on a non-production deployment emits `<meta name="robots" content="noindex, nofollow">`.
 * - When `ALLOW_INDEXING === true` (production), the caller's `noIndex`
 *   argument decides per-page (cart/checkout/login/etc. opt out).
 */
export function buildMetadata({
  title,
  description = BRAND.description,
  path = '/',
  image = BRAND.ogImage,
  noIndex = false,
  keywords = [],
}: BuildMetadataOpts): Metadata {
  const url = canonicalFor(path)
  const ogImageUrl = image.startsWith('http') ? image : canonicalFor(image)
  // Use absolute title to avoid the layout's `template` wrapping it twice.
  // When no title is provided, fall back to the brand default.
  const fullTitle = title
    ? `${title} — ${BRAND.name}`
    : `${BRAND.name} — ${BRAND.tagline}`

  // Force noindex on non-production deployments, regardless of caller input.
  // This is the core Phase 1.1 safety guarantee: even if a page forgets to
  // pass noIndex, staging can never be indexed.
  const effectiveNoIndex = noIndex || !ALLOW_INDEXING

  return {
    title: fullTitle,
    description,
    keywords: [
      'anima companion',
      'felcover',
      'felcover plus',
      'sioren',
      'forevet',
      'suplemen kucing',
      'suplemen anjing',
      'vitamin hewan',
      'kesehatan hewan peliharaan',
      'PT Sutan Vet Medika',
      ...keywords,
    ],
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: BRAND.name,
      locale: 'id_ID',
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: BRAND.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImageUrl],
    },
    ...(effectiveNoIndex ? { robots: { index: false, follow: false } } : {}),
  }
}

// =====================================================
// JSON-LD Structured Data
// =====================================================

/** Organization schema — sits in root layout, applies to whole site. */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND.name,
    legalName: BRAND.legalName,
    description: BRAND.description,
    url: SITE_URL,
    logo: canonicalFor(BRAND.logoUrl),
    email: BRAND.email,
    telephone: BRAND.phone,
    address: {
      '@type': 'PostalAddress',
      addressLocality: BRAND.address.city,
      addressRegion: BRAND.address.region,
      addressCountry: BRAND.address.country,
    },
    sameAs: Object.values(BRAND.social).filter(Boolean),
  }
}

/** WebSite schema — enables sitelinks search box in Google results. */
export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND.name,
    url: SITE_URL,
    inLanguage: 'id-ID',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/produk?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

interface ProductJsonLdInput {
  slug: string
  name: string
  description: string
  price: number
  salePrice?: number | null
  currency?: string
  brand: string
  image?: string
  sku?: string
  rating?: number
  reviewCount?: number
  bpomNumber?: string | null
  availability?: 'in stock' | 'out of stock' | 'preorder'
}

/** Product schema — emitted on /produk/[slug] pages for rich search results. */
export function productJsonLd(p: ProductJsonLdInput) {
  const url = canonicalFor(`/produk/${p.slug}`)
  const image = p.image
    ? p.image.startsWith('http')
      ? p.image
      : canonicalFor(p.image)
    : canonicalFor(BRAND.ogImage)
  const effectivePrice = p.salePrice ?? p.price
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    url,
    image,
    sku: p.sku,
    brand: {
      '@type': 'Brand',
      name: p.brand,
    },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: p.currency || 'IDR',
      price: effectivePrice,
      availability:
        p.availability ||
        (p.price > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'),
      itemCondition: 'https://schema.org/NewCondition',
    },
    aggregateRating:
      p.rating && p.reviewCount
        ? {
            '@type': 'AggregateRating',
            ratingValue: p.rating,
            reviewCount: p.reviewCount,
          }
        : undefined,
    additionalProperty: p.bpomNumber
      ? [
          {
            '@type': 'PropertyValue',
            name: 'BPOM Number',
            value: p.bpomNumber,
          },
        ]
      : undefined,
  }
}

interface BreadcrumbItem {
  name: string
  path: string
}

/** BreadcrumbList schema for navigation context. */
export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: canonicalFor(item.path),
    })),
  }
}
