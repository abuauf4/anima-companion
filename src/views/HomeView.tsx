'use client'
import { useEffect, useState, useRef } from 'react'
import { useHashRouter } from '@/lib/router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProductCard } from '@/components/product/ProductCard'
import { Image as OptImage } from '@/components/common/Image'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Reveal, Stagger, StaggerItem } from '@/components/common/Reveal'
import {
  Shield, Utensils, Sparkles, Bone, Activity, Eye, Heart, Sun,
  ArrowRight, MessageCircle, Star, ChevronRight, ChevronLeft,
  PawPrint,
  Mail, Gift,
} from 'lucide-react'
import {
  Product, PetType,
} from '@/hooks/use-fetch'
import { useHomeData } from '@/hooks/use-home-data'
import { VetSection } from '@/components/home/VetSection'
import { IngredientsReveal } from '@/components/home/IngredientsReveal'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { toast } from 'sonner'
import { formatRupiah } from '@/lib/format'

const PROBLEM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  imunitas: Shield,
  'nafsu-makan': Utensils,
  'bulu-dan-kulit': Sparkles,
  'tulang-dan-sendi': Bone,
  pencernaan: Activity,
  mata: Eye,
  recovery: Heart,
  harian: Sun,
}

export function HomeView() {
  const { navigate } = useHashRouter()
  // Stale-while-revalidate: instantly render cached data from sessionStorage,
  // refresh in background. isLoading=true only on truly first visit.
  const {
    isLoading,
    isStale,
    banners,
    bestSellers,
    newProducts,
    problems,
    testimonials,
    petTypes,
    settings,
  } = useHomeData()

  const [emailValue, setEmailValue] = useState('')

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailValue) return
    toast.success('Berhasil daftar newsletter! 🎁', {
      description: 'Voucher Rp 25.000 akan dikirim ke email Anda.',
    })
    setEmailValue('')
  }

  // Only Kucing & Anjing — Anima Companion only sells cat & dog supplements
  const mainPetTypes = petTypes.filter((p) => ['kucing', 'anjing'].includes(p.slug))

  return (
    <div className="overflow-x-hidden">
      {/* ==================== HERO — Redesign Phase 1 ====================
          Editorial, warm cream background, pet visual as primary element.
          - No gradient mesh, no glassmorphism, no floating trust cards.
          - Single primary CTA → /produk.
          - Headline kept short (2 lines max on mobile).
          - Image is the hero, not decoration. */}

      <section className="relative bg-background pb-10 pt-6 md:pb-16 md:pt-10">
        <div className="container-page">
          {/* Mobile-first vertical stack: image first (visual anchor),
              then text + CTA below. Desktop inverts to text left, image right. */}
          <div className="grid items-center gap-6 md:grid-cols-12 md:gap-10">
            {/* IMAGE: top on mobile, RIGHT (cols 7-12) on desktop */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="md:col-span-7 md:order-2"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl bg-muted md:aspect-[5/4]">
                <OptImage
                  src="/hero-pets-fresh.webp"
                  alt="Anima Companion — suplemen & vitamin hewan peliharaan rekomendasi dokter hewan"
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 60vw"
                  className="object-cover"
                />
              </div>
            </motion.div>

            {/* CONTENT: bottom on mobile, LEFT (cols 1-5) on desktop */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="md:col-span-5 md:order-1"
            >
              {/* Eyebrow — single small accent, no pill/badge */}
              <div className="mb-4 flex items-center gap-2 text-primary">
                <PawPrint className="size-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                  {settings?.heroEyebrow || 'Suplemen Rekomendasi Dokter Hewan'}
                </span>
              </div>

              {/* Headline — editorial, max 2 lines on mobile (390px) */}
              <h1 className="text-balance text-[28px] font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-[44px]">
                {settings?.heroTitle1 || 'Elevating'}{' '}
                <span className="text-primary">{settings?.heroTitle2 || 'Animal Health'}</span>
              </h1>

              {/* Supporting copy — max 2 short lines */}
              <p className="mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                {settings?.heroDescription || 'Suplemen & vitamin hewan peliharaan premium dari Anima Companion — PT Sutan Vet Medika. Diformulasikan bersama dokter hewan, tersedia di 515+ klinik seluruh Indonesia.'}
              </p>

              {/* Single primary CTA */}
              <div className="mt-6">
                <Button
                  size="lg"
                  onClick={() => navigate('/produk')}
                  className="h-12 gap-2 bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  Belanja Sekarang
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ==================== SHOP BY PET — dual visual CTA ====================
          Replaces the old PetTypeTiltCard section. Two visually distinct cards
          with cat/dog photography. Compact on mobile (side-by-side). */}

      <section className="bg-background pb-10 pt-2 md:pb-14">
        <div className="container-page">
          <div className="grid grid-cols-2 gap-3 md:gap-5">
            <ShopByPetCard
              variant="kucing"
              imageSrc="/pets/cat-portrait.webp"
              count={mainPetTypes.find(p => p.slug === 'kucing')?._count?.products || 0}
              onClick={() => navigate('/produk?pet=kucing')}
            />
            <ShopByPetCard
              variant="anjing"
              imageSrc="/pets/dog-portrait.webp"
              count={mainPetTypes.find(p => p.slug === 'anjing')?._count?.products || 0}
              onClick={() => navigate('/produk?pet=anjing')}
            />
          </div>
        </div>
      </section>

      {/* ==================== BEST SELLERS ==================== */}
      <section className="container-page py-10 md:py-14">
        <SectionHeader
          eyebrow="Paling Dicari"
          eyebrowIcon={<Star className="size-3 fill-amber-400 text-amber-400" />}
          title={<>Best <span className="gradient-brand-text">Seller</span> Bulan Ini</>}
          subtitle="Produk yang paling banyak dibeli dan diulas positif oleh pelanggan kami."
          action={
            <Button variant="outline" size="sm" onClick={() => navigate('/produk?bestSeller=1')} className="gap-1.5">
              Lihat Semua <ArrowRight className="size-4" />
            </Button>
          }
          className="mb-8"
        />

        {bestSellers.length === 0 ? (
          <BestSellerSkeleton />
        ) : (
          <BestSellerCarousel products={bestSellers} />
        )}
      </section>

      {/* ==================== SHOP BY BENEFIT (PROBLEM) ==================== */}
      <section className="bg-muted/30 py-10 md:py-14">
        <div className="container-page">
          <SectionHeader
            eyebrow="Belanja Berdasarkan Manfaat"
            eyebrowIcon={<Heart className="size-3 text-rose-500" />}
            title={<>Shop by <span className="gradient-brand-text">Benefit</span></>}
            subtitle="Pilih produk sesuai kebutuhan kesehatan hewan peliharaanmu."
            action={
              <Button variant="outline" size="sm" onClick={() => navigate('/problem')} className="gap-1.5">
                Semua Kategori <ArrowRight className="size-4" />
              </Button>
            }
            className="mb-8"
          />

          {problems.length === 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : (
            <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
              {problems.map((problem) => {
                const Icon = PROBLEM_ICONS[problem.slug] || Shield
                const color = problem.color || '#F97316'
                return (
                  <StaggerItem key={problem.id}>
                    <button
                      onClick={() => navigate(`/produk?problem=${problem.slug}`)}
                      className="group relative flex w-full flex-col items-start gap-2 overflow-hidden rounded-2xl border border-border/60 bg-card p-4 text-left transition-all hover:shadow-md hover:border-border"
                    >
                      {/* Radial color glow */}
                      <div
                        className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-30"
                      style={{ background: color }}
                    />
                    <div
                      className="flex size-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundColor: `${color}1a`, color }}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{problem.name}</h3>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {problem._count?.products || 0} produk
                      </p>
                    </div>
                  </button>
                </StaggerItem>
              )
            })}
            </Stagger>
          )}
        </div>
      </section>

      {/* ==================== INGREDIENTS REVEAL — Bahan Aktif Pilihan ==================== */}
      <IngredientsReveal />

      {/* ==================== NEW ARRIVALS — Hidden for now (will re-enable later) ==================== */}
      {/* <section className="py-10 md:py-14"> ... </section> */}

      {/* ==================== VET SECTION ==================== */}
      <VetSection />

      {/* ==================== TESTIMONIALS ==================== */}
      <section className="container-page py-10 md:py-14">
        <SectionHeader
          eyebrow="Kata Pelanggan"
          eyebrowIcon={<Heart className="size-3 text-rose-500" />}
          title={<>Apa Kata <span className="gradient-brand-text">Pelanggan</span> Kami</>}
          subtitle="Ribuan pelanggan telah mempercayakan kesehatan hewan peliharaan mereka pada kami."
          align="center"
          className="mb-10"
        />

        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {testimonials.map((t) => (
            <StaggerItem key={t.id}>
              <div className="flex h-full flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`size-3.5 ${i < t.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                    />
                  ))}
                </div>
                <p className="flex-1 text-sm leading-relaxed text-foreground/90">
                  &ldquo;{t.message}&rdquo;
                </p>
                <div className="flex items-center gap-2 border-t border-border/60 pt-3">
                  <div className="flex size-9 items-center justify-center rounded-full gradient-brand text-xs font-bold text-white">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground">{t.petName} · {t.petType}</p>
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ==================== NEWSLETTER CTA ==================== */}
      <section className="container-page pb-12 md:pb-16">
        <div className="relative overflow-hidden rounded-3xl gradient-brand p-6 text-center text-white shadow-xl sm:p-10">
          <div className="pointer-events-none absolute -right-12 -top-12 size-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 size-64 rounded-full bg-amber-300/20 blur-3xl" />

          <div className="relative mx-auto max-w-xl space-y-3">
            <Gift className="mx-auto size-10 text-amber-200" />
            <h2 className="text-balance text-2xl font-extrabold sm:text-3xl">
              Daftar & Dapat Voucher Rp 25.000
            </h2>
            <p className="text-sm text-white/90 sm:text-base">
              Berlangganan newsletter kami untuk info promo, tips kesehatan hewan, dan voucher
              spesial. Voucher Rp 25.000 langsung dikirim ke email Anda.
            </p>
            <form onSubmit={handleNewsletter} className="mx-auto mt-4 flex max-w-md flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                required
                placeholder="email@kamu.com"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                className="border-white/30 bg-white/95 text-foreground placeholder:text-muted-foreground"
              />
              <Button
                type="submit"
                variant="secondary"
                className="gap-1.5 bg-white text-primary hover:bg-white/90"
              >
                <Mail className="size-4" /> Klaim Voucher
              </Button>
            </form>
            <p className="text-[11px] text-white/70">
              Dengan mendaftar, Anda menyetujui kebijakan privasi kami.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ============== Shop by Pet — dual visual CTA (Redesign Phase 1) ============== */

/**
 * ShopByPetCard — a single card in the "Shop for Dogs / Shop for Cats" section.
 *
 * Two of these sit side-by-side on mobile (compact). Each card:
 * - Has a real pet photograph as the primary visual (not an emoji).
 * - Has a small paw print as a subtle identity accent.
 * - Uses different accent tone per variant (kucing=primary orange, anjing=secondary purple)
 *   so the two cards look visually distinct, not just two buttons with different labels.
 * - Is a button for a11y (clickable + keyboard focusable).
 */
function ShopByPetCard({
  variant,
  imageSrc,
  count,
  onClick,
}: {
  variant: 'kucing' | 'anjing'
  imageSrc: string
  count: number
  onClick: () => void
}) {
  const isCat = variant === 'kucing'
  const label = isCat ? 'Kucing' : 'Anjing'
  const cta = isCat ? 'Shop Cats' : 'Shop Dogs'

  // Distinct accent per variant — orange for cat, purple for dog.
  // (Matches the brand color roles: primary=orange, secondary=purple.)
  const accentText = isCat ? 'text-primary' : 'text-secondary'
  const accentHoverBg = isCat ? 'group-hover:bg-primary' : 'group-hover:bg-secondary'
  const accentRing = isCat ? 'group-hover:ring-primary/30' : 'group-hover:ring-secondary/30'

  return (
    <button
      onClick={onClick}
      aria-label={`Belanja untuk ${label}`}
      className={`group relative flex aspect-[4/5] w-full flex-col justify-end overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/50 transition-all duration-300 hover:shadow-md md:aspect-[4/5] md:rounded-3xl ${accentRing} hover:ring-2`}
    >
      {/* Pet photograph — primary visual, fills the card */}
      <OptImage
        src={imageSrc}
        alt={`Belanja suplemen untuk ${label}`}
        fill
        sizes="(max-width: 768px) 50vw, 33vw"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />

      {/* Subtle dark gradient at the bottom for text legibility */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />

      {/* Small paw print — identity accent, top-left corner */}
      <div className={`absolute left-3 top-3 flex size-9 items-center justify-center rounded-full bg-white/85 backdrop-blur-sm md:left-4 md:top-4 md:size-10`}>
        <PawPrint className={`size-4 ${accentText} md:size-5`} />
      </div>

      {/* Content — bottom */}
      <div className="relative z-10 p-3 text-left text-white md:p-5">
        {/* Variant label */}
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80 md:text-xs">
          Untuk {label}
        </p>
        {/* Big CTA word */}
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-lg font-bold leading-tight tracking-tight md:text-2xl">
            {cta}
          </span>
          {/* Arrow chip — accent-colored, expands on hover */}
          <span
            className={`flex size-7 items-center justify-center rounded-full bg-white text-foreground transition-all duration-300 group-hover:translate-x-0.5 md:size-9`}
          >
            <ArrowRight className="size-3.5 md:size-4" />
          </span>
        </div>
        {/* Product count — small, subtle */}
        <p className="mt-1 text-[10px] font-medium text-white/70 md:text-[11px]">
          {count} produk tersedia
        </p>
      </div>

      {/* Hidden accent bar at bottom for brand color identity */}
      <div className={`absolute bottom-0 left-0 h-0.5 w-0 transition-all duration-500 group-hover:w-full ${accentHoverBg}`} />
    </button>
  )
}

/* ============== New Arrival Poster Bento ============== */

/** Visual config per product slug — gradient, emoji, tagline */
const POSTER_CONFIG: Record<string, { gradient: string; emoji: string; tagline: string }> = {
  'sioren-booster-plus': {
    gradient: 'from-emerald-500 via-green-500 to-teal-600',
    emoji: '⚡',
    tagline: 'Pemulihan cepat & nafsu makan naik drastis',
  },
  'sioren-skin-coat': {
    gradient: 'from-pink-500 via-rose-500 to-fuchsia-600',
    emoji: '✨',
    tagline: 'Bulu lebat, mengilap, bebas gatal & ketombe',
  },
  'forevet-stress-manajemen': {
    gradient: 'from-violet-500 via-purple-500 to-indigo-600',
    emoji: '💖',
    tagline: 'Tenang saat ditinggal, perjalanan, atau ke dokter',
  },
}

const FALLBACK_POSTER = {
  gradient: 'from-orange-500 via-amber-500 to-rose-500',
  emoji: '🐾',
  tagline: 'Suplemen premium rekomendasi dokter hewan',
}

/**
 * Bento-style poster grid for New Arrivals.
 *
 * Layout:
 * - Mobile (<md): stacked vertical — big poster on top, 2 small below (side-by-side)
 * - Desktop (md+): 1 big poster left (spans 2 rows) + 2 small posters right (stacked)
 *
 * No gap between posters — seamless collage look.
 * Posters are clickable → navigate to product detail.
 */
function NewArrivalPosters({ products }: { products: Product[] }) {
  const { navigate } = useHashRouter()
  const big = products[0]
  const small1 = products[1]
  const small2 = products[2]

  if (!big) return null

  const renderPoster = (
    product: Product,
    opts: { size: 'big' | 'small' }
  ) => {
    const cfg = POSTER_CONFIG[product.slug] || FALLBACK_POSTER
    const isBig = opts.size === 'big'

    return (
      <button
        onClick={() => navigate(`/produk/${product.slug}`)}
        className={`group relative flex h-full w-full flex-col justify-end overflow-hidden bg-gradient-to-br ${cfg.gradient} text-left text-white transition-all duration-500 hover:brightness-110`}
        aria-label={`Lihat detail ${product.name}`}
      >
        {/* Decorative big emoji (faded, top-right) — scales on hover */}
        <span
          className={`pointer-events-none absolute -right-6 -top-6 select-none transition-transform duration-700 group-hover:scale-110 group-hover:rotate-6 ${
            isBig ? 'text-[180px] sm:text-[240px] md:text-[280px]' : 'text-[120px] sm:text-[140px]'
          }`}
          style={{ opacity: 0.18, lineHeight: 1 }}
          aria-hidden="true"
        >
          {cfg.emoji}
        </span>

        {/* Decorative paw pattern (faded, bottom-right) */}
        <svg
          viewBox="0 0 100 100"
          className="pointer-events-none absolute -bottom-8 -left-8 size-40 text-white/10 transition-transform duration-700 group-hover:scale-125 sm:size-56"
          fill="currentColor"
          aria-hidden="true"
        >
          <ellipse cx="30" cy="32" rx="9" ry="12" />
          <ellipse cx="48" cy="22" rx="9" ry="12" />
          <ellipse cx="66" cy="22" rx="9" ry="12" />
          <ellipse cx="78" cy="32" rx="9" ry="12" />
          <path d="M54 44c-12 0-22 9-22 21 0 9 6 15 12 15 3.6 0 6-1.2 8-2.4 2-1.2 3.2-1.2 5.2 0 2 1.2 4.4 2.4 8 2.4 6 0 12-6 12-15 0-12-11-21-23-21z" />
        </svg>

        {/* Dark gradient overlay for text contrast */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Content (bottom-left) */}
        <div className={`relative z-10 ${isBig ? 'p-8 sm:p-10 md:p-12' : 'p-5 sm:p-6'}`}>
          {/* BARU badge */}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-3 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm">
            <Sparkles className="size-3" /> Baru
          </span>

          {/* Product name */}
          <h3 className={`mt-3 font-extrabold leading-tight tracking-tight drop-shadow-sm ${
            isBig ? 'text-2xl sm:text-3xl md:text-4xl' : 'text-base sm:text-lg'
          }`}>
            {product.name}
          </h3>

          {/* Tagline */}
          <p className={`mt-2 max-w-[85%] font-medium text-white/90 ${
            isBig ? 'text-sm sm:text-base' : 'text-[11px] sm:text-xs'
          }`}>
            {cfg.tagline}
          </p>

          {/* Price + CTA */}
          <div className="mt-4 flex items-center gap-3">
            <span className={`font-bold drop-shadow-sm ${
              isBig ? 'text-xl sm:text-2xl' : 'text-sm sm:text-base'
            }`}>
              {formatRupiah(product.price)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-foreground transition-transform duration-300 group-hover:translate-x-1">
              Lihat Produk <ArrowRight className="size-3" />
            </span>
          </div>
        </div>
      </button>
    )
  }

  return (
    <Stagger className="grid grid-cols-2 gap-0 md:grid-cols-3 md:grid-rows-2 md:h-[560px]">
      {/* Big poster — full-width on mobile (col-span-2), left 2x2 on desktop */}
      <StaggerItem className="col-span-2 h-[360px] md:col-span-2 md:row-span-2 md:h-full">
        {renderPoster(big, { size: 'big' })}
      </StaggerItem>

      {/* Small poster 1 — bottom-left on mobile (col-span-1), top-right on desktop */}
      {small1 && (
        <StaggerItem className="col-span-1 h-[280px] md:col-span-1 md:row-span-1 md:h-full">
          {renderPoster(small1, { size: 'small' })}
        </StaggerItem>
      )}

      {/* Small poster 2 — bottom-right on mobile (col-span-1), bottom-right on desktop */}
      {small2 && (
        <StaggerItem className="col-span-1 h-[280px] md:col-span-1 md:row-span-1 md:h-full">
          {renderPoster(small2, { size: 'small' })}
        </StaggerItem>
      )}
    </Stagger>
  )
}

/* ============== Helpers ============== */

/**
 * Skeleton placeholder for Best Sellers section while data loads.
 * Matches the 3-card desktop layout (and 1-card mobile) so the
 * layout doesn't jump when real data arrives.
 */
function BestSellerSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {/* Mobile: 1 card, Desktop: 3 cards */}
      <div className="w-full shrink-0 lg:w-[calc((100%-2rem)/3)]">
        <div className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="hidden w-[calc((100%-2rem)/3)] shrink-0 lg:block">
        <div className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="hidden w-[calc((100%-2rem)/3)] shrink-0 lg:block">
        <div className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  )
}

/**
 * Best Seller Carousel
 * - Mobile: 1 card per view (full-width, snap)
 * - Desktop (lg+): 3 cards per view (snap)
 * - Arrow buttons scroll exactly 1 card width.
 * - Per-card motion: as the user scrolls horizontally, cards scale up & reach
 *   full opacity as they near the container's center; cards near the edges
 *   scale down to 0.92 and dim to 0.5 opacity (Task 4).
 */
function BestSellerCarousel({ products }: { products: Product[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollBy = (dir: 1 | -1) => {
    if (!scrollRef.current) return
    const container = scrollRef.current
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches
    // On desktop: 3 cards + 2 gaps (gap-4 = 16px) → card width = (clientWidth - 32) / 3
    // Scroll 1 card = cardWidth + gap
    // On mobile: 1 card per view, scroll = clientWidth
    const cardPlusGap = isDesktop
      ? (container.clientWidth - 32) / 3 + 16
      : container.clientWidth
    container.scrollBy({ left: dir * cardPlusGap, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      {/* Arrow controls — visible on all sizes (mobile + desktop) */}
      <button
        onClick={() => scrollBy(-1)}
        className="absolute -left-2 top-1/2 z-20 flex -translate-y-1/2 size-10 items-center justify-center rounded-full border border-border bg-card shadow-md transition-all hover:bg-accent hover:scale-105 active:scale-95 sm:-left-3 sm:size-11"
        aria-label="Sebelumnya"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        onClick={() => scrollBy(1)}
        className="absolute -right-2 top-1/2 z-20 flex -translate-y-1/2 size-10 items-center justify-center rounded-full border border-border bg-card shadow-md transition-all hover:bg-accent hover:scale-105 active:scale-95 sm:-right-3 sm:size-11"
        aria-label="Berikutnya"
      >
        <ChevronRight className="size-5" />
      </button>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]"
      >
        {products.map((p) => (
          <CarouselCard key={p.id} product={p} containerRef={scrollRef} />
        ))}
      </div>
    </div>
  )
}

/**
 * Single carousel card with scroll-position-driven scale/opacity.
 *
 * The card listens to its container's scroll events and computes a
 * "centered ratio" — 1 when the card is at the container's center, 0 when
 * it's at the far edge. This ratio drives `scale` (0.92 → 1) and `opacity`
 * (0.5 → 1) via motion values for buttery-smooth, re-render-free animation.
 */
function CarouselCard({
  product,
  containerRef,
}: {
  product: Product
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const scale = useMotionValue(1)
  const opacity = useMotionValue(1)

  useEffect(() => {
    const container = containerRef.current
    const card = cardRef.current
    if (!container || !card) return

    let raf = 0
    const update = () => {
      raf = 0
      const cRect = container.getBoundingClientRect()
      const eRect = card.getBoundingClientRect()
      if (cRect.width === 0 || eRect.width === 0) return
      const cardCenter = eRect.left + eRect.width / 2
      const containerCenter = cRect.left + cRect.width / 2
      const distance = Math.abs(cardCenter - containerCenter)
      // Normalised 0..1 — 1 at center, 0 at the container's edge
      const maxDistance = cRect.width / 2
      const ratio = Math.max(0, Math.min(1, 1 - distance / maxDistance))
      // Subtle scale/opacity — not over-the-top (user feedback: don't be too dramatic)
      scale.set(0.97 + 0.03 * ratio)
      opacity.set(0.85 + 0.15 * ratio)
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    // Initial compute + listeners
    update()
    container.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      container.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [containerRef, scale, opacity])

  return (
    <motion.div
      ref={cardRef}
      style={{ scale, opacity }}
      // Spring transition so the scale/opacity eases gently on scroll
      transition={{ type: 'spring', stiffness: 150, damping: 22 }}
      className="shrink-0 snap-start w-full lg:w-[calc((100%-2rem)/3)]"
    >
      <ProductCard product={product} />
    </motion.div>
  )
}

/** Horizontal scroll row of products with arrow controls (desktop) */
function ProductScrollRow({ products }: { products: Product[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollBy = (dir: 1 | -1) => {
    if (!scrollRef.current) return
    const amount = Math.min(scrollRef.current.clientWidth * 0.8, 600)
    scrollRef.current.scrollBy({ left: dir * amount, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      {/* Arrows (desktop only) */}
      <button
        onClick={() => scrollBy(-1)}
        className="absolute -left-3 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card p-2 shadow-md transition-colors hover:bg-accent lg:flex"
        aria-label="Scroll left"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        onClick={() => scrollBy(1)}
        className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card p-2 shadow-md transition-colors hover:bg-accent lg:flex"
        aria-label="Scroll right"
      >
        <ChevronRight className="size-5" />
      </button>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-4 [scrollbar-width:thin] sm:gap-4"
      >
        {products.map((p) => (
          <div key={p.id} className="w-36 shrink-0 sm:w-48 md:w-52">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </div>
  )
}
