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
  Product, Problem, Banner, Testimonial, PetType,
} from '@/hooks/use-fetch'
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

  const [banners, setBanners] = useState<Banner[]>([])
  const [bestSellers, setBestSellers] = useState<Product[]>([])
  const [newProducts, setNewProducts] = useState<Product[]>([])
  const [problems, setProblems] = useState<Problem[]>([])
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [petTypes, setPetTypes] = useState<PetType[]>([])

  const [emailValue, setEmailValue] = useState('')

  useEffect(() => {
    fetch('/api/home')
      .then((r) => r.json())
      .then((data) => {
        setBanners(data.banners || [])
        setBestSellers(data.bestSellers || [])
        setNewProducts(data.newProducts || [])
        setProblems(data.problems || [])
        setTestimonials(data.testimonials || [])
        setPetTypes(data.petTypes || [])
      })
      .catch((err) => console.error('Home fetch failed:', err))
  }, [])

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
      {/* ==================== HERO — Zesty Paws-style split ==================== */}
      <section className="relative overflow-hidden gradient-mesh-warm">
        {/* Decorative blurred orbs */}
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full bg-secondary/15 blur-3xl" />

        <div className="container-page relative grid items-center gap-4 py-4 md:grid-cols-2 md:gap-6 md:py-12 lg:py-16">
          {/* LEFT: Copy + CTA — compact on mobile, original on desktop */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-3 text-foreground md:space-y-4"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <PawPrint className="size-3" /> Suplemen Rekomendasi Dokter Hewan
            </span>

            <h1 className="text-balance text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
              Elevating<br />
              <span className="gradient-brand-text">Animal Health</span>
            </h1>

            <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              Suplemen & vitamin hewan peliharaan premium dari <span className="font-semibold text-foreground">Anima Companion</span> — PT Sutan Vet Medika. Diformulasikan bersama dokter hewan, tersedia di <span className="font-semibold text-foreground">515+ klinik</span> seluruh Indonesia.
            </p>

            {/* Hashtag pill — hidden on mobile to save vertical space */}
            <div className="hidden pt-1 sm:block">
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
                <Heart className="size-3" /> #PawrentHebatAnabulSehat
              </span>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Button
                size="lg"
                onClick={() => navigate('/shop?pet=anjing')}
                className="h-11 gap-2 bg-primary px-6 text-sm font-bold shadow-md hover:bg-primary/90"
              >
                🐕 Belanja untuk Anjing
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/shop?pet=kucing')}
                className="h-11 gap-2 border-secondary/30 bg-card px-6 text-sm font-semibold text-secondary hover:bg-secondary/5 hover:text-secondary"
              >
                🐈 Belanja untuk Kucing
              </Button>
            </div>

            {/* Trust stats below CTAs — hidden on mobile (saves vertical space,
                stats appear in announcement bar + vet section anyway) */}
            <div className="hidden grid-cols-2 gap-3 pt-4 sm:grid sm:grid-cols-4">
              {[
                { v: '50rb+', l: 'Pelanggan' },
                { v: '515+', l: 'Klinik Resmi' },
                { v: '4.9★', l: 'Rating' },
                { v: '24/7', l: 'Konsul Vet' },
              ].map((s) => (
                <div key={s.l} className="text-center sm:text-left">
                  <div className="text-lg font-extrabold gradient-brand-text sm:text-2xl">{s.v}</div>
                  <div className="text-[10px] text-muted-foreground sm:text-xs">{s.l}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* RIGHT: Hero image with floating cards — smaller on mobile */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative h-44 sm:h-80 md:h-96"
          >
            <div className="relative h-full w-full overflow-hidden rounded-3xl shadow-2xl ring-4 ring-white/60">
              <OptImage
                src="/hero-pets.webp"
                alt="Anima Companion — Elevating Animal Health"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
              {/* Soft overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-secondary/10" />
            </div>

            {/* Floating card — top-right: rating */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -right-2 top-4 flex items-center gap-2 rounded-2xl bg-card/95 p-2.5 shadow-xl ring-1 ring-border/30 backdrop-blur-sm sm:-right-4 sm:top-6"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
                <Star className="size-5 fill-amber-400 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">4.9★ 12rb+ ulasan</p>
                <p className="text-[10px] text-muted-foreground">Rating pelanggan</p>
              </div>
            </motion.div>

            {/* Floating card — bottom-left: BPOM */}
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              className="absolute -left-2 bottom-4 flex items-center gap-2 rounded-2xl bg-card/95 p-2.5 shadow-xl ring-1 ring-border/30 backdrop-blur-sm sm:-left-4 sm:bottom-8"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
                <Shield className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">BPOM Terdaftar</p>
                <p className="text-[10px] text-muted-foreground">100% Original</p>
              </div>
            </motion.div>

            {/* Floating card — top-left small: vet */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className="absolute left-4 top-4 hidden items-center gap-2 rounded-2xl bg-card/95 p-2.5 shadow-xl ring-1 ring-border/30 backdrop-blur-sm sm:flex"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/10">
                <MessageCircle className="size-5 text-secondary" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Gratis Konsul Vet</p>
                <p className="text-[10px] text-muted-foreground">Chat WhatsApp</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ==================== SHOP BY PET TYPE ==================== */}
      <section className="container-page py-10 md:py-14">
        <SectionHeader
          eyebrow="Belanja Berdasarkan Hewan"
          eyebrowIcon={<PawPrint className="size-3" />}
          title={<>Pilih <span className="gradient-brand-text">Hewan Peliharaanmu</span></>}
          subtitle="Suplemen khusus untuk kucing dan anjing — formula disesuaikan kebutuhan nutrisi masing-masing."
          className="mb-8"
        />

        {/* Two unique asymmetric cards: Kucing & Anjing — with 3D tilt on hover (desktop) */}
        <div className="grid gap-5 md:grid-cols-2">
          <PetTypeTiltCard config={PET_CARDS[0]} productCount={mainPetTypes.find(p => p.slug === 'kucing')?._count?.products || 0} delay={0} />
          <PetTypeTiltCard config={PET_CARDS[1]} productCount={mainPetTypes.find(p => p.slug === 'anjing')?._count?.products || 0} delay={0.05} />
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
            <Button variant="outline" size="sm" onClick={() => navigate('/shop?bestSeller=1')} className="gap-1.5">
              Lihat Semua <ArrowRight className="size-4" />
            </Button>
          }
          className="mb-8"
        />

        {bestSellers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            Memuat produk best seller...
          </div>
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

          <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
            {problems.map((problem) => {
              const Icon = PROBLEM_ICONS[problem.slug] || Shield
              const color = problem.color || '#F97316'
              return (
                <StaggerItem key={problem.id}>
                  <button
                    onClick={() => navigate(`/shop?problem=${problem.slug}`)}
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
        </div>
      </section>

      {/* ==================== INGREDIENTS REVEAL — Bahan Aktif Pilihan ==================== */}
      <IngredientsReveal />

      {/* ==================== NEW ARRIVALS — Bento Poster Grid ==================== */}
      <section className="py-10 md:py-14">
        <div className="container-page">
          <SectionHeader
            eyebrow="Produk Baru"
            eyebrowIcon={<Sparkles className="size-3 text-violet-500" />}
            title={<>New <span className="gradient-brand-text">Arrivals</span></>}
            subtitle="Produk terbaru dari Anima Companion yang baru saja diluncurkan."
            action={
              <Button variant="outline" size="sm" onClick={() => navigate('/shop?new=1')} className="gap-1.5">
                Lihat Semua <ArrowRight className="size-4" />
              </Button>
            }
            className="mb-8"
          />
        </div>

        {newProducts.length === 0 ? (
          <div className="container-page">
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              Memuat produk baru...
            </div>
          </div>
        ) : (
          <div className="container-page">
            <NewArrivalPosters products={newProducts} />
          </div>
        )}
      </section>

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

/* ============== Pet Type Cards (3D tilt) ============== */

interface PetCardConfig {
  slug: 'kucing' | 'anjing'
  emoji: string
  badgeText: string
  title: string
  description: string
  cardClass: string
  badgeClass: string
  pawColor: string
  pawHoverClass: string
  emojiBadgeClass: string
}

/**
 * Visual config for the two main pet-type cards (Kucing & Anjing).
 * The Kucing card uses warm orange tones; the Anjing card uses cool violet tones.
 */
const PET_CARDS: PetCardConfig[] = [
  {
    slug: 'kucing',
    emoji: '🐈',
    badgeText: 'Untuk Kucing',
    title: 'Felcover+, Sioren &\nForevet untuk Kucing',
    description:
      'Imun booster, nafsu makan, fish oil, skin & coat, flu support, dan stress management.',
    cardClass:
      'bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 hover:shadow-orange-200/50',
    badgeClass: 'bg-orange-500/10 text-orange-600',
    pawColor: 'text-orange-200/60',
    pawHoverClass: 'group-hover:scale-110 group-hover:rotate-6',
    emojiBadgeClass: '',
  },
  {
    slug: 'anjing',
    emoji: '🐕',
    badgeText: 'Untuk Anjing',
    title: 'Felcover+, Sioren &\nForevet untuk Anjing',
    description:
      'Imun booster, nafsu makan, fish oil, skin & coat, flu support, dan stress management.',
    cardClass:
      'bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 hover:shadow-violet-200/50',
    badgeClass: 'bg-violet-500/10 text-violet-600',
    pawColor: 'text-violet-200/60',
    pawHoverClass: 'group-hover:-rotate-3 group-hover:scale-110',
    emojiBadgeClass: '',
  },
]

/**
 * Pet Type card with a subtle 3D tilt on hover (desktop only — touch devices
 * don't fire mousemove, so the card stays flat on mobile, which is fine).
 *
 * The card rotates around X and Y axes based on the cursor's position over
 * the card. A decorative paw print inside parallaxes in the opposite
 * direction for a layered, depth feel. On mouse leave, the card springs
 * back to flat.
 */
function PetTypeTiltCard({
  config,
  productCount,
  delay,
}: {
  config: PetCardConfig
  productCount: number
  delay: number
}) {
  const { navigate } = useHashRouter()

  // Mouse position relative to card center, in pixels (-half..+half).
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  // Derive rotation from mouse position — max ±8 degrees at the edges.
  const rotateX = useTransform(y, [-50, 50], [8, -8])
  const rotateY = useTransform(x, [-50, 50], [-8, 8])

  // Paw print parallax — moves opposite to tilt (half magnitude) for depth.
  const pawX = useTransform(x, [-50, 50], [10, -10])
  const pawY = useTransform(y, [-50, 50], [10, -10])

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const xPct = e.clientX - rect.left - rect.width / 2
    const yPct = e.clientY - rect.top - rect.height / 2
    x.set(xPct)
    y.set(yPct)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  // Split title on "\n" so each line breaks naturally (preserves the
  // existing visual layout with the line break between brand list & pet type).
  const titleLines = config.title.split('\n')

  return (
    <Reveal delay={delay}>
      <motion.button
        onClick={() => navigate(`/shop?pet=${config.slug}`)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ rotateX, rotateY, transformPerspective: 900 }}
        // Spring transition so the tilt eases in/out smoothly
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        className={`group relative flex h-72 w-full flex-col justify-end overflow-hidden rounded-3xl p-6 text-left shadow-sm transition-shadow duration-300 hover:shadow-xl sm:h-80 sm:p-8 ${config.cardClass}`}
        aria-label={`Belanja untuk ${config.badgeText.replace('Untuk ', '')}`}
      >
        {/* Decorative paw print SVG (large, top-right, faded) — parallaxes on tilt */}
        <motion.div
          style={{ x: pawX, y: pawY }}
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-8"
        >
          <svg
            viewBox="0 0 100 100"
            className={`size-48 transition-transform duration-500 sm:size-64 ${config.pawColor} ${config.pawHoverClass}`}
            fill="currentColor"
          >
            <ellipse cx="30" cy="32" rx="9" ry="12" />
            <ellipse cx="48" cy="22" rx="9" ry="12" />
            <ellipse cx="66" cy="22" rx="9" ry="12" />
            <ellipse cx="78" cy="32" rx="9" ry="12" />
            <path d="M54 44c-12 0-22 9-22 21 0 9 6 15 12 15 3.6 0 6-1.2 8-2.4 2-1.2 3.2-1.2 5.2 0 2 1.2 4.4 2.4 8 2.4 6 0 12-6 12-15 0-12-11-21-23-21z" />
          </svg>
        </motion.div>

        {/* Floating emoji badge (top-right) */}
        <span className="absolute right-5 top-5 z-10 flex size-14 items-center justify-center rounded-2xl bg-white/80 text-3xl shadow-lg backdrop-blur-sm transition-transform duration-300 group-hover:scale-110 sm:right-7 sm:top-7 sm:size-16 sm:text-4xl">
          {config.emoji}
        </span>

        {/* Content (bottom-left) */}
        <div className="relative z-10">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${config.badgeClass}`}
          >
            {config.badgeText}
          </span>
          <h3 className="mt-3 text-2xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-3xl">
            {titleLines.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </h3>
          <p className="mt-2 max-w-[80%] text-sm text-muted-foreground">
            {config.description}
          </p>
          <div className="mt-4 flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-background transition-transform group-hover:translate-x-1">
              Jelajahi <ArrowRight className="size-4" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {productCount} produk tersedia
            </span>
          </div>
        </div>
      </motion.button>
    </Reveal>
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
        onClick={() => navigate(`/product/${product.slug}`)}
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
      {/* Arrow controls (visible on all sizes — useful on both mobile & desktop) */}
      <button
        onClick={() => scrollBy(-1)}
        className="absolute -left-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card p-2 shadow-md transition-colors hover:bg-accent sm:flex"
        aria-label="Sebelumnya"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        onClick={() => scrollBy(1)}
        className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card p-2 shadow-md transition-colors hover:bg-accent sm:flex"
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
      scale.set(0.92 + 0.08 * ratio)
      opacity.set(0.5 + 0.5 * ratio)
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
