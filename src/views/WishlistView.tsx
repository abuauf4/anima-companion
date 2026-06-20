'use client'

import { useHashRouter } from '@/lib/router'
import { useWishlistStore, useCartStore } from '@/lib/store'
import { formatRupiah, effectivePrice } from '@/lib/format'
import { Image as OptImage } from '@/components/common/Image'
import { Button } from '@/components/ui/button'
import { Heart, ShoppingCart, Trash2, ArrowRight, PawPrint } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

/**
 * Wishlist page — shows products user has saved via the heart toggle.
 *
 * No login required. Items persist in localStorage (zustand persist).
 */
export function WishlistView() {
  const { navigate } = useHashRouter()
  const items = useWishlistStore((s) => s.items)
  const removeItem = useWishlistStore((s) => s.removeItem)
  const clearWishlist = useWishlistStore((s) => s.clear)
  const addItem = useCartStore((s) => s.addItem)

  const handleAddToCart = (item: typeof items[number]) => {
    addItem({
      productId: item.productId,
      slug: item.slug,
      name: item.name,
      brand: item.brand,
      price: item.price,
      salePrice: item.salePrice,
      image: item.image,
      weight: item.weight,
    })
    toast.success(`${item.name} ditambahkan ke keranjang`)
  }

  const handleRemove = (productId: string, name: string) => {
    removeItem(productId)
    toast.success(`${name} dihapus dari wishlist`)
  }

  const handleClear = () => {
    if (confirm('Hapus semua produk dari wishlist?')) {
      clearWishlist()
      toast.success('Wishlist dikosongkan')
    }
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-rose-50 text-rose-400">
          <Heart className="size-10" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Wishlist Kamu Masih Kosong</h1>
        <p className="mb-6 max-w-md text-sm text-muted-foreground">
          Belum ada produk yang kamu simpan. Klik ikon hati (♥) di produk mana pun untuk
          menyimpannya di sini — gak perlu login, tersimpan otomatis di browser kamu.
        </p>
        <Button onClick={() => navigate('/shop')} className="gap-2">
          <PawPrint className="size-4" /> Mulai Belanja
        </Button>
      </div>
    )
  }

  return (
    <div className="container-page py-8 md:py-12">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-600">
            <Heart className="size-3 fill-rose-500 text-rose-500" /> Wishlist
          </span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Produk Favorit Kamu
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} produk tersimpan di browser ini. Klik produk untuk lihat detail, atau
            langsung masukkan ke keranjang.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          className="hidden gap-1.5 text-destructive hover:bg-destructive/5 hover:text-destructive sm:flex"
        >
          <Trash2 className="size-4" /> Kosongkan
        </Button>
      </div>

      {/* Grid of wishlist items */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item, i) => {
          const price = effectivePrice(item.price, item.salePrice)
          const discount = item.salePrice
            ? Math.round(((item.price - item.salePrice) / item.price) * 100)
            : 0

          return (
            <motion.div
              key={item.productId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-shadow hover:shadow-md"
            >
              {/* Image (clickable → product detail) */}
              <button
                onClick={() => navigate(`/product/${item.slug}`)}
                className="relative aspect-square overflow-hidden bg-muted"
                aria-label={`Lihat detail ${item.name}`}
              >
                <OptImage
                  src={item.image}
                  alt={item.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  brandName={item.brand}
                  slug={item.slug}
                />
                {discount > 0 && (
                  <span className="absolute right-0 top-0 bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    -{discount}%
                  </span>
                )}
              </button>

              {/* Remove button (top-right of image) */}
              <button
                onClick={() => handleRemove(item.productId, item.name)}
                aria-label={`Hapus ${item.name} dari wishlist`}
                className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-white/90 text-rose-500 shadow-sm ring-1 ring-rose-200 backdrop-blur-sm transition-all hover:scale-110 hover:bg-white active:scale-95"
              >
                <Heart className="size-4 fill-rose-500 text-rose-500" />
              </button>

              {/* Body */}
              <div className="flex flex-1 flex-col gap-1 p-3">
                {item.brand && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {item.brand}
                  </span>
                )}
                <h3
                  className="cursor-pointer line-clamp-2 text-sm font-medium leading-tight text-foreground transition-colors hover:text-primary"
                  onClick={() => navigate(`/product/${item.slug}`)}
                >
                  {item.name}
                </h3>
                {item.weight && (
                  <span className="text-[10px] text-muted-foreground">{item.weight}</span>
                )}

                {/* Price */}
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-base font-bold text-primary">
                    {formatRupiah(price)}
                  </span>
                  {discount > 0 && (
                    <span className="text-[10px] text-muted-foreground line-through">
                      {formatRupiah(item.price)}
                    </span>
                  )}
                </div>

                {/* Add to cart */}
                <Button
                  size="sm"
                  onClick={() => handleAddToCart(item)}
                  className="mt-3 w-full gap-1.5"
                >
                  <ShoppingCart className="size-3.5" /> Tambah ke Keranjang
                </Button>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Mobile clear button */}
      <div className="mt-8 flex justify-center sm:hidden">
        <Button
          variant="outline"
          onClick={handleClear}
          className="gap-1.5 text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          <Trash2 className="size-4" /> Kosongkan Wishlist
        </Button>
      </div>

      {/* Bottom CTA */}
      <div className="mt-10 flex justify-center">
        <Button variant="ghost" onClick={() => navigate('/shop')} className="gap-1.5">
          Lanjut Belanja <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
