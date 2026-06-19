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
  PawPrint, Package,
  Mail, Gift, ShoppingCart,
} from 'lucide-react'
import {
  Product, Problem, Banner, Testimonial, PetType,
} from '@/hooks/use-fetch'
import { VetSection } from '@/components/home/VetSection'
import { motion } from 'framer-motion'
import { useCartStore } from '@/lib/store'
import { toast } from 'sonner'
import { formatRupiah, effectivePrice } from '@/lib/format'

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

// Bundles — "Paket Hemat" curated bundles based on product problems
const BUNDLES: { problemSlug: string; title: string; tag: string; emoji: string; gradient: string }[] = [
  { problemSlug: 'nafsu-makan', title: 'Paket Nafsu Makan', tag: 'HEMAT 25%', emoji: '🍗', gradient: 'from-orange-400 to-rose-400' },
  { problemSlug: 'imunitas', title: 'Paket Imunitas', tag: 'HEMAT 30%', emoji: '🛡️', gradient: 'from-emerald-400 to-teal-500' },
  { problemSlug: 'bulu-dan-kulit', title: 'Paket Bulu Sehat', tag: 'B2G1 FREE', emoji: '✨', gradient: 'from-pink-400 to-fuchsia-400' },
  { problemSlug: 'recovery', title: 'Paket Recovery', tag: 'HEMAT 28%', emoji: '💖', gradient: 'from-sky-400 to-cyan-500' },
]

export function HomeView() {
  const { navigate } = useHashRouter()
  const addItem = useCartStore((s) => s.addItem)

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

  // Bundles derived from bestSellers (grouped by problem)
  const bundles = BUNDLES.map((b) => {
    const productsInBundle = [...bestSellers, ...newProducts].filter((p) =>
      p.problems?.some((pp) => pp.problem.slug === b.problemSlug)
    ).slice(0, 3)
    if (productsInBundle.length === 0) return null
    const totalPrice = productsInBundle.reduce(
      (sum, p) => sum + effectivePrice(p.price, p.salePrice),
      0
    )
    const bundlePrice = Math.round(totalPrice * 0.75)
    return { ...b, products: productsInBundle, totalPrice, bundlePrice }
  }).filter(Boolean).slice(0, 4) as Array<{
    problemSlug: string
    title: string
    tag: string
    emoji: string
    gradient: string
    products: Product[]
    totalPrice: number
    bundlePrice: number
  }>

  const handleAddBundle = (bundle: typeof bundles[number]) => {
    bundle.products.forEach((p) => {
      addItem({
        productId: p.id,
        slug: p.slug,
        name: p.name,
        price: p.price,
        salePrice: p.salePrice,
        image: p.images?.[0]?.url || '',
        weight: p.weight,
      })
    })
    toast.success(`${bundle.title} ditambahkan ke keranjang`, {
      description: `${bundle.products.length} produk • Hemat ${formatRupiah(bundle.totalPrice - bundle.bundlePrice)}`,
    })
  }

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailValue) return
    toast.success('Berhasil daftar newsletter! 🎁', {
      description: 'Voucher Rp 25.000 akan dikirim ke email Anda.',
    })
    setEmailValue('')
  }

  // Big pet-type cards (Kucing + Anjing) + small row (Burung, Ikan, Hewan Kecil)
  const mainPetTypes = petTypes.filter((p) => ['kucing', 'anjing'].includes(p.slug))
  const otherPetTypes = petTypes.filter((p) => !['kucing', 'anjing'].includes(p.slug))

  const petEmoji: Record<string, string> = {
    kucing: '🐈', anjing: '🐕', burung: '🐦', ikan: '🐟', 'hewan-kecil': '🐰',
  }
  const petGradient: Record<string, string> = {
    kucing: 'from-orange-100 to-rose-100',
    anjing: 'from-violet-100 to-sky-100',
    burung: 'from-amber-100 to-yellow-100',
    ikan: 'from-cyan-100 to-blue-100',
    'hewan-kecil': 'from-emerald-100 to-teal-100',
  }

  return (
    <div className="overflow-x-hidden">
      {/* ==================== HERO — Zesty Paws-style split ==================== */}
      <section className="relative overflow-hidden gradient-mesh-warm">
        {/* Decorative blurred orbs */}
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full bg-secondary/15 blur-3xl" />

        <div className="container-page relative grid items-center gap-6 py-8 md:grid-cols-2 md:py-12 lg:py-16">
          {/* LEFT: Copy + CTA */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4 text-foreground"
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

            {/* Hashtag pill */}
            <div className="pt-1">
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

            {/* Trust stats below CTAs */}
            <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4">
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

          {/* RIGHT: Hero image with floating cards */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative h-64 sm:h-80 md:h-96"
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
          subtitle="Kami punya suplemen khusus untuk setiap jenis hewan — formula disesuaikan kebutuhan nutrisi masing-masing."
          className="mb-8"
        />

        {/* Big cards: Kucing & Anjing */}
        <div className="grid gap-4 sm:grid-cols-2">
          {mainPetTypes.map((pet, i) => (
            <Reveal key={pet.id} delay={i * 0.1}>
              <button
                onClick={() => navigate(`/shop?pet=${pet.slug}`)}
                className={`group relative flex w-full items-center overflow-hidden rounded-3xl bg-gradient-to-br ${petGradient[pet.slug]} p-6 text-left transition-all hover:shadow-lg sm:p-8`}
              >
                <div className="relative z-10 flex-1">
                  <span className="text-4xl sm:text-5xl">{petEmoji[pet.slug]}</span>
                  <h3 className="mt-3 text-xl font-bold text-foreground sm:text-2xl">
                    Untuk {pet.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                    {pet._count?.products || 0} produk tersedia
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    Jelajahi Produk <ArrowRight className="size-3 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
                <span className="pointer-events-none absolute -right-4 -top-4 text-[120px] opacity-20 transition-transform group-hover:scale-110 sm:text-[180px]">
                  {petEmoji[pet.slug]}
                </span>
              </button>
            </Reveal>
          ))}
        </div>

        {/* Small row: Burung, Ikan, Hewan Kecil */}
        {otherPetTypes.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3 sm:gap-4">
            {otherPetTypes.map((pet, i) => (
              <Reveal key={pet.id} delay={0.1 + i * 0.05}>
                <button
                  onClick={() => navigate(`/shop?pet=${pet.slug}`)}
                  className={`group flex w-full flex-col items-center gap-2 rounded-2xl bg-gradient-to-br ${petGradient[pet.slug]} p-3 text-center transition-all hover:shadow-md sm:p-4`}
                >
                  <span className="text-2xl sm:text-3xl">{petEmoji[pet.slug]}</span>
                  <span className="text-xs font-semibold text-foreground sm:text-sm">{pet.name}</span>
                  <span className="text-[10px] text-muted-foreground">{pet._count?.products || 0} produk</span>
                </button>
              </Reveal>
            ))}
          </div>
        )}
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

      {/* ==================== NEW ARRIVALS ==================== */}
      <section className="bg-muted/30 py-10 md:py-14">
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

          {newProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              Memuat produk baru...
            </div>
          ) : (
            <ProductScrollRow products={newProducts} />
          )}
        </div>
      </section>

      {/* ==================== BUNDLES ==================== */}
      {bundles.length > 0 && (
        <section className="container-page py-10 md:py-14">
          <SectionHeader
            eyebrow="Paket Hemat"
            eyebrowIcon={<Package className="size-3 text-amber-500" />}
            title={<>Bundling <span className="gradient-brand-text">Hemat</span></>}
            subtitle="Beli paket bundling dan hemat sampai 30%. Produk terkurasi sesuai kebutuhan."
            className="mb-8"
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {bundles.map((bundle, i) => (
              <Reveal key={bundle.title} delay={i * 0.08}>
                <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all hover:shadow-md">
                  <div className={`relative flex h-24 items-center justify-center bg-gradient-to-br ${bundle.gradient}`}>
                    <span className="text-4xl">{bundle.emoji}</span>
                    <span className="absolute right-2 top-2 rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-rose-600 shadow-sm">
                      {bundle.tag}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <h3 className="text-sm font-bold text-foreground">{bundle.title}</h3>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {bundle.products.length} produk dalam paket
                    </p>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-base font-bold text-primary">
                        {formatRupiah(bundle.bundlePrice)}
                      </span>
                      <span className="text-[11px] text-muted-foreground line-through">
                        {formatRupiah(bundle.totalPrice)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="mt-3 w-full gap-1.5"
                      onClick={() => handleAddBundle(bundle)}
                    >
                      <ShoppingCart className="size-3.5" /> Tambah Paket
                    </Button>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

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

/* ============== Helpers ============== */

/**
 * Best Seller Carousel
 * - Mobile: 1 card per view (full-width, snap)
 * - Desktop (lg+): 3 cards per view (snap)
 * Arrow buttons scroll exactly 1 card width.
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
          <div
            key={p.id}
            className="shrink-0 snap-start w-full lg:w-[calc((100%-2rem)/3)]"
          >
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </div>
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
