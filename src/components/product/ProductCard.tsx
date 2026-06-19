'use client'

import { Product } from '@/hooks/use-fetch'
import { useHashRouter } from '@/lib/router'
import { useCartStore } from '@/lib/store'
import { formatRupiah, effectivePrice, discountPercent } from '@/lib/format'
import { Image as OptImage } from '@/components/common/Image'
import { ShoppingCart, Check, Shield, Star, BadgeCheck, Repeat } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import { motion } from 'framer-motion'

/**
 * Compact product card — Zesty Paws / marketplace style.
 *
 * - Square image, dense grid
 * - Best Seller / Baru ribbon top-left, discount % top-right
 * - Subscribe & Save small green badge under discount
 * - BPOM badge bottom-left of image
 * - Floating cart button bottom-right
 * - Brand + seller (clickable) under product name
 * - Star rating + review count row
 */
export function ProductCard({ product }: { product: Product }) {
  const { navigate } = useHashRouter()
  const addItem = useCartStore((s) => s.addItem)
  const [added, setAdded] = useState(false)

  const price = effectivePrice(product.price, product.salePrice)
  const discount = discountPercent(product.price, product.salePrice)

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (product.stock <= 0) {
      toast.error('Produk sedang habis')
      return
    }
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      price: product.price,
      salePrice: product.salePrice,
      image: product.images?.[0]?.url || '',
      weight: product.weight,
    })
    toast.success(`${product.name} ditambahkan`, {
      description: product.weight ? `Berat: ${product.weight}` : undefined,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1200)
  }

  const handleSellerClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (product.seller?.slug) {
      navigate(`/shop?brand=${encodeURIComponent(product.seller.slug)}`)
    }
  }

  const rating = product.rating ?? 0
  const reviewCount = product.reviewCount ?? 0

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      onClick={() => navigate(`/product/${product.slug}`)}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-border/60 bg-card transition-shadow duration-200 hover:shadow-md hover:border-border"
    >
      {/* ==================== Image ==================== */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {product.images?.[0]?.url ? (
          <OptImage
            src={product.images[0].url}
            alt={product.images[0].alt || product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            brandName={product.brand}
            slug={product.slug}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            No image
          </div>
        )}

        {/* Top ribbon: Best Seller / Baru */}
        {product.isBestSeller && (
          <span className="absolute left-0 top-0 bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
            ⭐ Best Seller
          </span>
        )}
        {!product.isBestSeller && product.isNew && (
          <span className="absolute left-0 top-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
            Baru
          </span>
        )}

        {/* Discount badge + Subscribe badge — top-right column */}
        <div className="absolute right-0 top-0 flex flex-col items-end gap-0.5">
          {discount > 0 && (
            <span className="bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
              -{discount}%
            </span>
          )}
          {product.isSubscribeEligible && (
            <span className="flex items-center gap-0.5 bg-emerald-500 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-sm">
              <Repeat className="size-2.5" /> Save 15%
            </span>
          )}
        </div>

        {/* BPOM mini badge — bottom-left of image */}
        {product.bpomNumber && (
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 rounded-md bg-emerald-500/95 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-sm">
            <Shield className="size-2.5" /> BPOM
          </span>
        )}

        {/* Floating add-to-cart (bottom-right) */}
        <button
          onClick={handleAdd}
          disabled={product.stock <= 0}
          aria-label={`Tambah ${product.name} ke keranjang`}
          className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-white/80 transition-all hover:scale-110 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
        >
          <motion.span
            key={added ? 'added' : 'idle'}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.12 }}
          >
            {added ? <Check className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5" />}
          </motion.span>
        </button>

        {/* Out of stock overlay */}
        {product.stock <= 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-[1px]">
            <span className="rounded-md bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background">
              Stok Habis
            </span>
          </div>
        )}
      </div>

      {/* ==================== Body ==================== */}
      <div className="flex flex-1 flex-col gap-0.5 p-2 sm:p-2.5">
        {/* Seller / brand link (clickable) */}
        {product.seller && (
          <button
            onClick={handleSellerClick}
            className="flex w-fit items-center gap-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-primary"
            title={`Lihat semua produk dari ${product.seller.name}`}
          >
            {product.seller.isVerified && <BadgeCheck className="size-3 text-sky-500" />}
            <span className="truncate">{product.seller.name}</span>
          </button>
        )}

        {/* Name — 2 lines max */}
        <h3 className="line-clamp-2 min-h-[1.75rem] text-[11px] font-medium leading-tight text-foreground transition-colors group-hover:text-primary sm:text-xs">
          {product.name}
        </h3>

        {/* Rating row */}
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <Star className="size-2.5 fill-amber-400 text-amber-400" />
          <span className="font-semibold text-foreground">{rating.toFixed(1)}</span>
          <span className="text-muted-foreground/70">({reviewCount})</span>
          <span className="ml-auto text-muted-foreground/70">
            {product.stock > 50
              ? '1rb+ terjual'
              : product.stock > 20
                ? '100+ terjual'
                : product.stock > 0
                  ? '10+ terjual'
                  : 'Stok habis'}
          </span>
        </div>

        {/* Price block */}
        <div className="mt-0.5 flex items-baseline gap-1">
          <span className="text-sm font-bold leading-none text-primary">
            {formatRupiah(price)}
          </span>
          {discount > 0 && (
            <span className="text-[9px] text-muted-foreground line-through">
              {formatRupiah(product.price)}
            </span>
          )}
        </div>

        {/* Subscribe price hint */}
        {product.isSubscribeEligible && product.subscribePrice && (
          <span className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] font-medium text-emerald-600">
            <Repeat className="size-2.5" />
            Subscribe {formatRupiah(product.subscribePrice)}
          </span>
        )}
      </div>
    </motion.div>
  )
}
