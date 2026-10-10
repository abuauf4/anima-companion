/**
 * SEO helpers for Anima Companion — central place for canonical URLs,
 * metadata builders, and JSON-LD structured data.
 *
 * Two independent env vars control SEO behavior:
 *
 * - `NEXT_PUBLIC_SITE_URL` — official canonical production domain.
 *   MUST always be `https://animacompanion.id`, on every deployment.
 *
 * - `NEXT_PUBLIC_ALLOW_INDEXING` — whether THIS deployment may be indexed.
 *   "true" → production only. Anything else (or unset) → staging/preview/local,
 *   forces noindex,nofollow sitewide and disallows all crawling in robots.txt.
 */

import type { Metadata } from 'next'

/** Canonical site origin (no trailing slash). Always the production domain. */
const PRODUCTION_SITE_URL = 'https://animacompanion.id'
const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')

export const SITE_URL = configuredSiteUrl === PRODUCTION_SITE_URL
  ? configuredSiteUrl
  : PRODUCTION_SITE_URL

/** Safe default: only an explicitly-enabled production build may be indexed. */
export const ALLOW_INDEXING = process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true'

/** Brand defaults pulled from existing site config so copy stays in sync. */
export const BRAND = {
  name: 'Anima Companion',
  legalName: 'PT Sutan Vet Medika',
  tagline: 'Elevating Animal Health',
  description:
    'Anima Companion (PT Sutan Vet Medika) — suplemen & vitamin hewan peliharaan premium untuk kucing dan anjing. Produk Felcover+, Sioren, dan Forevet. Tersedia di 400+ klinik hewan seluruh Indonesia.',
  logoUrl: '/anima-logo.svg',
  ogImage: '/og-image.png',
  email: 'sutanvetmedika@gmail.com',
  phone: '+6282210846408',
  address: {
    street: 'Gedung STP - IPB lt 1',
    city: 'Bogor',
    region: 'Jawa Barat',
    country: 'ID',
  },
  social: {
    instagram: 'https://instagram.com/anima.companion',
    tiktok: 'https://www.tiktok.com/@anima.companion',
    shopee: 'https://shopee.co.id/anima.companion',
    tokopedia: 'https://www.tokopedia.com/find/felcover',
  },
  hours: 'Senin–Sabtu, 09.00–18.00 WIB',
}

export const ENTITY_IDS = {
  organization: `${SITE_URL}/#organization`,
  brand: `${SITE_URL}/#brand`,
  website: `${SITE_URL}/#website`,
  homepage: `${SITE_URL}/#webpage`,
} as const

/**
 * Build canonical URL for a path. Always absolute with SITE_URL origin.
 * @example canonicalFor('/produk') → 'https://animacompanion.id/produk'
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
  /** Prevent indexing for account / transactional pages. */
  noIndex?: boolean
  /** Optional keywords */
  keywords?: string[]
}

/** Build a complete, canonical metadata object for a page. */
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

  // Avoid titles like "Anima Companion ... — Anima Companion" when a page
  // already carries the brand name explicitly.
  const fullTitle = title
    ? title.toLowerCase().includes(BRAND.name.toLowerCase())
      ? title
      : `${title} — ${BRAND.name}`
    : `${BRAND.name} — ${BRAND.tagline}`

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
          alt: `${BRAND.name} — ${BRAND.tagline}`,
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
// JSON-LD structured data
// =====================================================

/** Legal/company entity that publishes the website and owns Anima Companion. */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ENTITY_IDS.organization,
    name: BRAND.legalName,
    alternateName: BRAND.name,
    description: BRAND.description,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: canonicalFor(BRAND.logoUrl),
    },
    brand: {
      '@id': ENTITY_IDS.brand,
    },
    email: BRAND.email,
    telephone: BRAND.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BRAND.address.street,
      addressLocality: BRAND.address.city,
      addressRegion: BRAND.address.region,
      addressCountry: BRAND.address.country,
    },
    sameAs: Object.values(BRAND.social).filter(Boolean),
  }
}

/** Consumer-facing Anima Companion brand entity. */
export function brandJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Brand',
    '@id': ENTITY_IDS.brand,
    name: BRAND.name,
    slogan: BRAND.tagline,
    description: BRAND.description,
    url: SITE_URL,
    logo: canonicalFor(BRAND.logoUrl),
    sameAs: Object.values(BRAND.social).filter(Boolean),
  }
}

/** Website entity, explicitly published by PT Sutan Vet Medika. */
export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': ENTITY_IDS.website,
    name: BRAND.name,
    alternateName: `${BRAND.name} Official Website`,
    url: SITE_URL,
    description: BRAND.description,
    inLanguage: 'id-ID',
    publisher: {
      '@id': ENTITY_IDS.organization,
    },
    about: {
      '@id': ENTITY_IDS.brand,
    },
  }
}

/** Homepage entity that connects the page, website, brand and publisher. */
export function homepageJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': ENTITY_IDS.homepage,
    url: SITE_URL,
    name: `${BRAND.name} | Suplemen & Vitamin Hewan Peliharaan`,
    description: BRAND.description,
    inLanguage: 'id-ID',
    isPartOf: {
      '@id': ENTITY_IDS.website,
    },
    about: {
      '@id': ENTITY_IDS.brand,
    },
    mainEntity: {
      '@id': ENTITY_IDS.brand,
    },
    publisher: {
      '@id': ENTITY_IDS.organization,
    },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: canonicalFor(BRAND.ogImage),
      width: 1200,
      height: 630,
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
  const availability = p.availability === 'in stock'
    ? 'https://schema.org/InStock'
    : p.availability === 'out of stock'
      ? 'https://schema.org/OutOfStock'
      : p.availability === 'preorder'
        ? 'https://schema.org/PreOrder'
        : p.price > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock'

  const productBrand = p.brand.toLowerCase() === BRAND.name.toLowerCase()
    ? {
        '@type': 'Brand',
        '@id': ENTITY_IDS.brand,
        name: BRAND.name,
      }
    : {
        '@type': 'Brand',
        name: p.brand,
      }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    url,
    image,
    sku: p.sku,
    brand: productBrand,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: p.currency || 'IDR',
      price: effectivePrice,
      availability,
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@id': ENTITY_IDS.organization,
      },
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
