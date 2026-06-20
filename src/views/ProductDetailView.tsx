'use client'

import { useEffect, useState } from 'react'
import { useHashRouter } from '@/lib/router'
import { useCartStore, useWishlistStore } from '@/lib/store'
import { Product } from '@/hooks/use-fetch'
import { ProductCard } from '@/components/product/ProductCard'
import { Image as OptImage } from '@/components/common/Image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  ShoppingCart, Check, Minus, Plus, Star, Truck, Shield, MessageCircle,
  ChevronRight, Heart, Share2, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatRupiah, effectivePrice, discountPercent } from '@/lib/format'
import { SITE_CONFIG, whatsappAdminUrl } from '@/lib/config'
import { SectionHeader } from '@/components/common/SectionHeader'
import { motion } from 'framer-motion'
import { getIngredients, type Ingredient } from '@/lib/ingredients-data'
import { Leaf, Bone, Eye, Sun, Activity, Droplet } from 'lucide-react'

export function ProductDetailView({ slug }: { slug: string }) {
  const { navigate } = useHashRouter()
  const addItem = useCartStore((s) => s.addItem)
  const toggleWishlist = useWishlistStore((s) => s.toggleItem)
  const [data, setData] = useState<{ product: Product; related: Product[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  const [added, setAdded] = useState(false)

  // Derive productId BEFORE useWishlistStore — avoids TDZ error
  // (selector runs immediately via useSyncExternalStore, so it can't
  // reference `data` which is declared above but in TDZ at call time)
  const productId = data?.product?.id || ''
  const isWishlisted = useWishlistStore((s) =>
    s.items.some((item) => item.productId === productId)
  )

  useEffect(() => {
    setLoading(true)
    fetch(`/api/products?slug=${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error('not found')
        return r.json()
      })
      .then((d) => {
        setData(d)
        setActiveImage(0)
        setQuantity(1)
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="container-page py-6">
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-square rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 text-5xl">🐱</div>
        <h1 className="mb-2 text-2xl font-bold">Produk Tidak Ditemukan</h1>
        <p className="mb-6 text-muted-foreground">Produk yang Anda cari tidak tersedia.</p>
        <Button onClick={() => navigate('/shop')}>Kembali ke Belanja</Button>
      </div>
    )
  }

  const { product, related } = data
  const price = effectivePrice(product.price, product.salePrice)
  const discount = discountPercent(product.price, product.salePrice)
  const images = product.images || []

  const handleAddToCart = () => {
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
      image: images[0]?.url || '',
      weight: product.weight,
    }, quantity)
    toast.success(`${product.name} (${quantity}x) ditambahkan ke keranjang`)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  const handleBuyNow = () => {
    handleAddToCart()
    setTimeout(() => navigate('/cart'), 300)
  }

  const handleWishlist = () => {
    if (!data?.product) return
    const product = data.product
    toggleWishlist({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      price: product.price,
      salePrice: product.salePrice,
      image: product.images?.[0]?.url || '',
      weight: product.weight,
    })
    toast.success(
      isWishlisted ? `${product.name} dihapus dari wishlist` : `${product.name} ditambahkan ke wishlist`,
      { description: isWishlisted ? undefined : 'Lihat di halaman Wishlist' }
    )
  }

  const handleShare = async () => {
    if (!data?.product) return
    const product = data.product
    const shareUrl = `${window.location.origin}/#/product/${product.slug}`
    const shareText = `${product.name} — ${formatRupiah(product.price)} di Anima Companion`

    // Try Web Share API first (mobile + desktop browsers that support it)
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: shareText,
          url: shareUrl,
        })
        return
      } catch (err) {
        // User cancelled — silently ignore
        if (err instanceof Error && err.name === 'AbortError') return
        // Fall through to clipboard fallback
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Link produk disalin ke clipboard', {
        description: shareUrl,
      })
    } catch {
      // Last resort: select-then-prompt
      toast.error('Gagal menyalin link', {
        description: `Salin manual: ${shareUrl}`,
      })
    }
  }

  return (
    <div className="container-page py-4 md:py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-xs md:mb-6 md:text-sm text-muted-foreground">
        <button onClick={() => navigate('/')} className="hover:text-primary">Beranda</button>
        <ChevronRight className="h-3 w-3" />
        <button onClick={() => navigate('/shop')} className="hover:text-primary">Belanja</button>
        <ChevronRight className="h-3 w-3" />
        <button
          onClick={() => navigate(`/shop?category=${product.category.slug}`)}
          className="hover:text-primary"
        >
          {product.category.name}
        </button>
        <ChevronRight className="h-3 w-3" />
        <span className="truncate text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:gap-12">
        {/* ==================== Gallery ==================== */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-xl md:rounded-2xl border border-border bg-muted">
            {images[activeImage] ? (
              <OptImage
                src={images[activeImage].url}
                alt={images[activeImage].alt || product.name}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="h-full w-full object-cover"
                brandName={product.brand}
                slug={product.slug}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                No image
              </div>
            )}
            {/* Top-left badges: status */}
            {(product.isBestSeller || product.isNew) && (
              <div className="absolute left-2 top-2 flex flex-col gap-1 md:left-3 md:top-3 md:gap-1.5">
                {product.isBestSeller && <Badge className="bg-primary text-primary-foreground text-[10px] shadow-sm">Best Seller</Badge>}
                {product.isNew && <Badge className="bg-secondary text-secondary-foreground text-[10px] shadow-sm">Baru</Badge>}
              </div>
            )}
            {/* Top-right: discount */}
            {discount > 0 && (
              <div className="absolute right-2 top-2 md:right-3 md:top-3">
                <Badge className="bg-destructive text-destructive-foreground text-[10px] shadow-sm">-{discount}%</Badge>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="mt-2 grid grid-cols-4 gap-1.5 md:mt-3 md:gap-2">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(i)}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
                    i === activeImage ? 'border-primary' : 'border-border hover:border-primary/30'
                  }`}
                >
                  <OptImage
                    src={img.url}
                    alt={img.alt || `${product.name} ${i + 1}`}
                    fill
                    sizes="(max-width: 768px) 15vw, 100px"
                    className="h-full w-full object-cover"
                    brandName={product.brand}
                    slug={product.slug}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ==================== Info ==================== */}
        <div className="space-y-4 md:space-y-6">
          {/* Brand + actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {product.brand}
              </span>
              {product.bpomNumber && (
                <Badge variant="outline" className="gap-1 text-success border-success/30 bg-success/5 text-[10px]">
                  <Shield className="h-3 w-3" /> {product.bpomNumber}
                </Badge>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={handleWishlist}
                aria-label={isWishlisted ? `Hapus ${data?.product?.name} dari wishlist` : `Tambah ${data?.product?.name} ke wishlist`}
                aria-pressed={isWishlisted}
              >
                <Heart className={`h-4 w-4 transition-colors ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={handleShare}
                aria-label="Bagikan produk"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2 md:space-y-3">
            <h1 className="text-balance text-2xl font-bold leading-tight tracking-tight md:text-4xl">{product.name}</h1>

            {/* Rating */}
            {product.reviewCount && product.reviewCount > 0 && (
              <div className="flex items-center gap-2 text-xs md:text-sm">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 md:h-4 md:w-4 ${
                        i < Math.round(product.avgRating || 0)
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-muted text-muted'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-semibold">{product.avgRating?.toFixed(1)}</span>
                <span className="text-muted-foreground">({product.reviewCount} ulasan)</span>
              </div>
            )}
          </div>

          {/* Problem tags */}
          {product.problems && product.problems.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
              <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mengatasi:</span>
              {product.problems.map((p) => (
                <button
                  key={p.problem.id}
                  onClick={() => navigate(`/problem/${p.problem.slug}`)}
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 md:px-3 md:py-1 text-[11px] md:text-xs font-medium transition-all hover:scale-105"
                  style={{
                    backgroundColor: (p.problem.color || '#888') + '15',
                    color: p.problem.color || '#888',
                  }}
                >
                  {p.problem.name}
                </button>
              ))}
            </div>
          )}

          {/* Price card */}
          <div className="rounded-xl md:rounded-2xl border border-border bg-accent/40 p-4 md:p-5">
            {product.salePrice ? (
              <div className="flex flex-wrap items-end gap-2 md:gap-3">
                <span className="text-2xl font-bold text-primary md:text-4xl">{formatRupiah(product.salePrice)}</span>
                <span className="mb-1.5 text-sm md:text-base text-muted-foreground line-through">{formatRupiah(product.price)}</span>
                <Badge className="mb-1.5 md:mb-2 bg-destructive text-destructive-foreground text-[10px] md:text-xs">Hemat {discount}%</Badge>
              </div>
            ) : (
              <span className="text-2xl font-bold text-foreground md:text-4xl">{formatRupiah(product.price)}</span>
            )}
            {product.weight && (
              <p className="mt-1.5 md:mt-2 text-[11px] md:text-xs text-muted-foreground">Berat bersih: {product.weight}</p>
            )}
          </div>

          {/* Pet types + stock */}
          <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
            {product.petTypes && product.petTypes.length > 0 && (
              <div>
                <p className="mb-1.5 md:mb-2 text-[10px] md:text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cocok untuk</p>
                <div className="flex flex-wrap gap-1.5">
                  {product.petTypes.map((p) => (
                    <Badge key={p.petType.id} variant="outline" className="gap-1 border-border-strong text-[11px] md:text-xs">
                      {p.petType.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="mb-1.5 md:mb-2 text-[10px] md:text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ketersediaan</p>
              {product.stock > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-0.5 md:px-2.5 md:py-1 text-xs md:text-sm font-medium text-success">
                  <Check className="h-3.5 w-3.5 md:h-4 md:w-4" /> Stok {product.stock} unit
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-0.5 md:px-2.5 md:py-1 text-xs md:text-sm font-medium text-destructive">
                  Stok Habis
                </span>
              )}
            </div>
          </div>

          {/* Quantity + Add to cart — desktop: 1 row (qty + 2 buttons), mobile: stack */}
          <div className="hidden gap-3 sm:flex-row sm:items-stretch md:flex">
            <div className="flex items-center justify-between rounded-xl border border-border-strong bg-card sm:justify-start">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="h-12 w-12 rounded-r-none"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="h-12 w-14 border-0 text-center text-base font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                min={1}
                max={product.stock}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                disabled={quantity >= product.stock}
                className="h-12 w-12 rounded-l-none"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button
              onClick={handleAddToCart}
              disabled={product.stock <= 0}
              size="lg"
              variant="outline"
              className="h-12 flex-1 gap-2 border-border-strong"
            >
              {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
              {added ? 'Ditambahkan' : 'Tambah ke Keranjang'}
            </Button>

            <Button
              onClick={handleBuyNow}
              disabled={product.stock <= 0}
              size="lg"
              className="h-12 flex-1 gap-2 shadow-glow"
            >
              Beli Sekarang
            </Button>
          </div>

          {/* Mobile-only: qty selector full-width + Tambah Keranjang full-width button.
              Beli Sekarang is in mobile sticky bottom bar. */}
          <div className="space-y-2 md:hidden">
            {/* Quantity selector — full width */}
            <div className="flex items-center justify-between rounded-xl border border-border-strong bg-card">
              <span className="pl-4 text-xs font-medium text-muted-foreground">Jumlah</span>
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="h-11 w-11 rounded-r-none"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-11 w-14 border-0 text-center text-base font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  min={1}
                  max={product.stock}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={quantity >= product.stock}
                  className="h-11 w-11 rounded-l-none"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {/* Tambah Keranjang — full width */}
            <Button
              onClick={handleAddToCart}
              disabled={product.stock <= 0}
              variant="outline"
              className="h-11 w-full gap-2 border-border-strong text-sm"
            >
              {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
              {added ? 'Ditambahkan ke Keranjang' : 'Tambah ke Keranjang'}
            </Button>
          </div>

          {/* Ask via WhatsApp */}
          <a
            href={whatsappAdminUrl(`Halo Anima Companion! Saya ingin bertanya tentang produk ${product.name} (${formatRupiah(price)}) 🐾`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="h-11 w-full gap-2 border-success/40 bg-success/5 text-success hover:bg-success hover:text-success-foreground text-xs md:text-sm">
              <MessageCircle className="h-4 w-4" /> Tanya Produk via WhatsApp
            </Button>
          </a>

          {/* Trust */}
          <div className="grid grid-cols-3 gap-2 md:gap-3 rounded-xl md:rounded-2xl border border-border bg-card p-3 md:p-4 text-center">
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Truck className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </div>
              <p className="text-[10px] md:text-xs font-semibold">Pengiriman Cepat</p>
              <p className="text-[9px] md:text-[10px] text-muted-foreground">1-4 hari kerja</p>
            </div>
            <div className="flex flex-col items-center gap-1 border-x border-border">
              <div className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Shield className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </div>
              <p className="text-[10px] md:text-xs font-semibold">100% Asli</p>
              <p className="text-[9px] md:text-[10px] text-muted-foreground">BPOM Terdaftar</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </div>
              <p className="text-[10px] md:text-xs font-semibold">Fast Response</p>
              <p className="text-[9px] md:text-[10px] text-muted-foreground">via WhatsApp</p>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== Tabs: Description / Benefit / Usage / Ingredients / Reviews ==================== */}
      <div className="mt-8 pb-24 md:mt-16 md:pb-0">
        <Tabs defaultValue="description">
          <TabsList className="w-full justify-start overflow-x-auto h-11 md:h-12">
            <TabsTrigger value="description" className="text-xs md:text-sm">Deskripsi</TabsTrigger>
            <TabsTrigger value="benefit" className="text-xs md:text-sm">Manfaat</TabsTrigger>
            <TabsTrigger value="usage" className="text-xs md:text-sm">Cara Pakai</TabsTrigger>
            <TabsTrigger value="ingredients" className="text-xs md:text-sm">Kandungan</TabsTrigger>
            <TabsTrigger value="reviews" className="text-xs md:text-sm">Ulasan ({product.reviews?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="description" className="mt-4 md:mt-6">
            <Card className="p-4 md:p-7">
              <p className="whitespace-pre-line text-sm md:text-base leading-relaxed text-foreground/90">{product.description}</p>
            </Card>
          </TabsContent>

          <TabsContent value="benefit" className="mt-4 md:mt-6">
            <Card className="p-4 md:p-7">
              <p className="whitespace-pre-line text-sm md:text-base leading-relaxed text-foreground/90">{product.benefit}</p>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="mt-4 md:mt-6">
            <Card className="p-4 md:p-7">
              <p className="whitespace-pre-line text-sm md:text-base leading-relaxed text-foreground/90">{product.usage}</p>
            </Card>
          </TabsContent>

          <TabsContent value="ingredients" className="mt-4 md:mt-6">
            <IngredientSpotlight slug={product.slug} rawIngredients={product.ingredients} />
          </TabsContent>

          <TabsContent value="reviews" className="mt-4 md:mt-6">
            <ReviewsSection product={product} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ==================== Related Products ==================== */}
      {related.length > 0 && (
        <div className="mt-8 pb-24 md:mt-16 md:pb-0">
          <SectionHeader
            eyebrow="Rekomendasi"
            eyebrowIcon={<Sparkles className="h-3 w-3" />}
            title="Produk Terkait"
            className="mb-4 md:mb-8"
          />
          <div className="grid grid-cols-2 gap-3 md:gap-4 sm:grid-cols-3 lg:grid-cols-4 sm:gap-5">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      {/* Mobile sticky CTA bar */}
      {product.stock > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 p-3 backdrop-blur md:hidden">
          <div className="container-page flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground">Total</span>
              <span className="text-base font-bold text-primary">{formatRupiah(price * quantity)}</span>
            </div>
            <Button
              onClick={handleAddToCart}
              variant="outline"
              className="h-11 flex-1 gap-1.5 border-border-strong"
            >
              <ShoppingCart className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleBuyNow}
              className="h-11 flex-1 gap-1.5"
            >
              Beli Sekarang
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card ${className}`}>{children}</div>
}

function ReviewsSection({ product }: { product: Product }) {
  const reviews = product.reviews || []
  const avg = product.avgRating || 0

  const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length
    return {
      star,
      count,
      percent: reviews.length ? (count / reviews.length) * 100 : 0,
    }
  })

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        {/* Summary */}
        <Card className="p-6 text-center">
          <p className="text-5xl font-bold">{avg.toFixed(1)}</p>
          <div className="mt-2 flex items-center justify-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-5 w-5 ${i < Math.round(avg) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{reviews.length} ulasan</p>
        </Card>

        {/* Breakdown */}
        <Card className="p-6">
          <h3 className="mb-4 text-sm font-semibold">Distribusi Rating</h3>
          <div className="space-y-2">
            {ratingBreakdown.map((r) => (
              <div key={r.star} className="flex items-center gap-3">
                <div className="flex w-12 items-center gap-1 text-sm">
                  {r.star} <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                </div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-amber-400" style={{ width: `${r.percent}%` }} />
                </div>
                <span className="w-8 text-right text-sm text-muted-foreground">{r.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Review list */}
      {reviews.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mb-2 text-3xl">💬</div>
          <p className="text-sm text-muted-foreground">Belum ada ulasan untuk produk ini</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-brand text-white text-sm font-bold">
                    {r.userName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{r.userName}</p>
                    {r.petType && (
                      <p className="text-xs text-muted-foreground">Pelanggan {r.petType}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 ${i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
                    />
                  ))}
                </div>
              </div>
              <p className="mt-3 text-sm text-foreground/90">{r.comment}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}


// ============ Ingredient Spotlight Component ============
const INGREDIENT_ICON_MAP = {
  leaf: Leaf,
  heart: Heart,
  bone: Bone,
  shield: Shield,
  eye: Eye,
  sun: Sun,
  activity: Activity,
  sparkles: Sparkles,
  drop: Droplet,
  star: Star,
} as const;

function IngredientSpotlight({ slug, rawIngredients }: { slug: string; rawIngredients?: string }) {
  const ingredients = getIngredients(slug);

  if (ingredients.length === 0) {
    // Fallback: show plain text if no structured data
    return (
      <Card className="p-7">
        <p className="whitespace-pre-line leading-relaxed text-foreground/90">{rawIngredients || 'Informasi kandungan akan segera tersedia.'}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-7">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-10 h-10 rounded-xl gradient-brand-soft flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Kandungan Aktif</h3>
            <p className="text-xs text-muted-foreground">{ingredients.length} bahan aktif dalam formula ini</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ingredients.map((ing, i) => {
            const Icon = INGREDIENT_ICON_MAP[ing.icon] || Leaf;
            return (
              <motion.div
                key={ing.name}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="group flex items-start gap-3 p-4 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors border border-border/40"
              >
                <div className="shrink-0 w-11 h-11 rounded-lg gradient-brand flex items-center justify-center shadow-sm">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h4 className="font-semibold text-foreground text-sm">{ing.name}</h4>
                    <span className="text-xs font-mono text-primary font-semibold">{ing.dose}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ing.benefit}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-6 pt-5 border-t border-border/60 flex items-start gap-2 text-xs text-muted-foreground">
          <Shield className="w-4 h-4 shrink-0 mt-0.5 text-success" />
          <p className="leading-relaxed">
            Semua bahan aktif telah melalui uji klinis di laboratorium <span className="font-semibold text-foreground">BRIN</span> dan diformulasikan oleh tim riset <span className="font-semibold text-foreground">IPB University</span>. Dosis disesuaikan untuk keamanan dan efektivitas optimal.
          </p>
        </div>
      </Card>
    </div>
  );
}

