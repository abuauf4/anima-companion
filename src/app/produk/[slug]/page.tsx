import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/layout/SiteShell";
import { ProductDetailView } from "@/views/ProductDetailView";
import { buildMetadata, productJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { db } from "@/lib/db";

// /produk/[slug] — product detail page.
// Server component that fetches product at request time for SEO metadata
// and JSON-LD structured data. The ProductDetailView (client) re-fetches
// via /api/products for cart/wishlist interactions.

interface Params {
  params: Promise<{ slug: string }>
}

async function fetchProduct(slug: string) {
  const product = await db.product.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      description: true,
      price: true,
      salePrice: true,
      brand: true,
      sku: true,
      bpomNumber: true,
      rating: true,
      reviewCount: true,
      stock: true,
      isActive: true,
      images: { take: 1, orderBy: { order: 'asc' } },
    },
  })
  return product
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const product = await fetchProduct(slug)

  if (!product || !product.isActive) {
    return buildMetadata({
      title: "Produk Tidak Ditemukan",
      description: "Produk yang Anda cari tidak tersedia.",
      path: `/produk/${slug}`,
      noIndex: true,
    })
  }

  const description = product.description?.slice(0, 160) || "Suplemen & vitamin hewan peliharaan premium dari Anima Companion."
  const image = product.images?.[0]?.url

  return buildMetadata({
    title: product.name,
    description,
    path: `/produk/${product.slug}`,
    image: image || undefined,
    keywords: [product.name, product.brand, product.sku].filter(Boolean),
  })
}

export default async function ProductDetailPage({ params }: Params) {
  const { slug } = await params
  const product = await fetchProduct(slug)

  if (!product || !product.isActive) {
    notFound()
  }

  const jsonLd = productJsonLd({
    slug: product.slug,
    name: product.name,
    description: product.description?.slice(0, 500) || "",
    price: product.price,
    salePrice: product.salePrice,
    brand: product.brand,
    sku: product.sku,
    image: product.images?.[0]?.url,
    rating: product.rating,
    reviewCount: product.reviewCount,
    bpomNumber: product.bpomNumber,
    availability: product.stock > 0 ? 'in stock' : 'out of stock',
  })

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Beranda", path: "/" },
    { name: "Produk", path: "/produk" },
    { name: product.name, path: `/produk/${product.slug}` },
  ])

  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <ProductDetailView slug={slug} />
    </SiteShell>
  )
}
