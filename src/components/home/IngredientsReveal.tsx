'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform, useInView } from 'framer-motion'
import { FlaskConical, ArrowRight } from 'lucide-react'
import { useHashRouter } from '@/lib/router'
import { SectionHeader } from '@/components/common/SectionHeader'

/**
 * Premium Active Ingredients — "Bahan Aktif Pilihan"
 *
 * A stacked-card reveal section showcasing 8 key Anima Companion ingredients.
 *
 * Layout:
 * - Desktop (md+): 2-column asymmetric grid
 *   * LEFT (40%, sticky): section header + active ingredient index (01-08)
 *     + active name + active description — updates as user scrolls
 *   * RIGHT (60%): vertical scroll list of full-width cards (80vh each)
 * - Mobile (<md): single column — section header on top, then the cards
 *   scroll vertically with the same reveal animation
 *
 * Card motion (THE KEY):
 * - Active card (centered in viewport): opacity 1, scale 1, y 0
 * - Card above (exiting top): opacity 0.3, scale 0.95, y -50
 * - Card below (entering bottom): opacity 0.3, scale 0.95, y 50
 * - Subtle parallax: emoji moves slightly slower than card
 */

interface Ingredient {
  name: string
  subtitle: string
  description: string
  benefit: string
  color: string
  emoji: string
  product: string
}

const INGREDIENTS: Ingredient[] = [
  {
    name: 'Kolostrum',
    subtitle: 'Immune Stimulant',
    description:
      'Sumber imunoglobulin alami yang meningkatkan daya tahan tubuh anabul. Awal pertahanan terhadap infeksi virus dan bakteri.',
    benefit: 'Imunitas',
    color: 'from-orange-400 to-amber-500',
    emoji: '🛡️',
    product: 'Felcover+',
  },
  {
    name: 'Prebiotik',
    subtitle: 'Gut Health Booster',
    description:
      'Makanan untuk bakteri baik di usus. Menyeimbangkan mikroflora pencernaan, mengatasi diare, dan meningkatkan penyerapan nutrisi.',
    benefit: 'Pencernaan',
    color: 'from-emerald-400 to-teal-500',
    emoji: '🌱',
    product: 'Felcover+',
  },
  {
    name: 'Omega-3 (EPA & DHA)',
    subtitle: 'Wild Fish Oil',
    description:
      'Asam lemak esensial dari minyak ikan murni. Membuat bulu lebat mengkilap, menjaga kesehatan jantung, otak, dan mengurangi peradangan.',
    benefit: 'Bulu & Kulit',
    color: 'from-cyan-400 to-blue-500',
    emoji: '🐟',
    product: 'Sioren Fish Oil',
  },
  {
    name: 'Alpha-Casozepine',
    subtitle: 'Stress Relief Protein',
    description:
      'Protein susu yang menenangkan sistem saraf tanpa membuat anabul ngantuk. Membantu saat ditinggal, perjalanan, atau kunjungan ke dokter.',
    benefit: 'Stress Management',
    color: 'from-violet-400 to-purple-500',
    emoji: '💖',
    product: 'Forevet',
  },
  {
    name: 'L-Lysine',
    subtitle: 'Immune Amino Acid',
    description:
      'Asam amino esensial yang membantu tubuh melawan virus herpes dan flu. Meningkatkan nafsu makan dan mempercepat pemulihan.',
    benefit: 'Flu Support',
    color: 'from-rose-400 to-pink-500',
    emoji: '🦠',
    product: 'Sioren Flu Support+',
  },
  {
    name: 'L-Carnitine',
    subtitle: 'Energy Booster',
    description:
      'Mengubah lemak menjadi energi. Meningkatkan stamina, nafsu makan, dan mempercepat pemulihan setelah sakit atau operasi.',
    benefit: 'Recovery',
    color: 'from-yellow-400 to-orange-500',
    emoji: '⚡',
    product: 'Sioren Booster+',
  },
  {
    name: 'Biotin',
    subtitle: 'Skin & Coat Vitamin',
    description:
      'Vitamin B7 yang esensial untuk kesehatan kulit dan bulu. Mengatasi bulu rontok, gatal, ketombe, dan membuat bulu lebih lebat.',
    benefit: 'Bulu Sehat',
    color: 'from-fuchsia-400 to-pink-500',
    emoji: '✨',
    product: 'Sioren Skin & Coat',
  },
  {
    name: 'Active Charcoal',
    subtitle: 'Natural Odor Absorber',
    description:
      'Arang aktif alami yang menyerap bau ammonia dan kelembaban. Menjaga litterbox tetap segar hingga 24 jam, aman dipakai harian.',
    benefit: 'Odor Control',
    color: 'from-slate-500 to-zinc-700',
    emoji: '🪨',
    product: 'Sioren Pet Odor X',
  },
]

/** Map product display name → product slug (for click-to-detail navigation) */
const PRODUCT_SLUG: Record<string, string> = {
  'Felcover+': 'felcover-plus-immune-stimulant',
  'Sioren Fish Oil': 'sioren-fish-oil',
  Forevet: 'forevet-stress-manajemen',
  'Sioren Flu Support+': 'sioren-flu-support-plus',
  'Sioren Booster+': 'sioren-booster-plus',
  'Sioren Skin & Coat': 'sioren-skin-coat',
  'Sioren Pet Odor X': 'sioren-pet-odor-x',
}

/** Single ingredient card — uses scroll progress to drive opacity/scale/y */
function IngredientCard({
  ingredient,
  index,
  onActive,
}: {
  ingredient: Ingredient
  index: number
  onActive: (idx: number) => void
}) {
  const { navigate } = useHashRouter()
  const ref = useRef<HTMLButtonElement>(null)

  // Track when this card is the most-visible — triggers sticky panel update.
  // amount: 0.5 means at least 50% of the card must be visible to be "active".
  const inView = useInView(ref, { amount: 0.5 })

  useEffect(() => {
    if (inView) onActive(index)
  }, [inView, index, onActive])

  // Per-card scroll progress: 0 = card just entered bottom of viewport,
  // 0.5 = card centered, 1 = card just exited top of viewport.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  // Active card is at scrollYProgress ≈ 0.5.
  // Outside the 0.4–0.6 band, the card fades to 0.3 opacity and scales down.
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.4, 0.5, 0.6, 1],
    [0.3, 0.3, 1, 0.3, 0.3],
  )
  const scale = useTransform(
    scrollYProgress,
    [0, 0.4, 0.5, 0.6, 1],
    [0.95, 0.95, 1, 0.95, 0.95],
  )
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [50, 0, -50])

  // Emoji parallax — moves slower than card (half the distance).
  const emojiY = useTransform(scrollYProgress, [0, 0.5, 1], [20, 0, -20])

  const handleNavigate = () => {
    const slug = PRODUCT_SLUG[ingredient.product]
    if (slug) navigate(`/product/${slug}`)
  }

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={handleNavigate}
      style={{ opacity, scale, y }}
      aria-label={`Lihat produk ${ingredient.product} — bahan aktif ${ingredient.name}`}
      className={`group relative flex h-[70vh] w-full flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br ${ingredient.color} p-6 text-left text-white shadow-2xl ring-1 ring-white/10 transition-shadow hover:shadow-3xl sm:h-[80vh] sm:p-8`}
    >
      {/* Decorative big emoji (top-right, faded) — parallaxes slightly */}
      <motion.span
        style={{ y: emojiY }}
        aria-hidden="true"
        className="pointer-events-none absolute -right-4 -top-8 select-none text-[180px] leading-none sm:text-[240px]"
      >
        <span className="block opacity-15">{ingredient.emoji}</span>
      </motion.span>

      {/* Soft white radial glow — top-left for depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-12 -top-12 size-72 rounded-full bg-white/15 blur-3xl"
      />

      {/* TOP: Subtitle (uppercase tracking) */}
      <div className="relative z-10">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest backdrop-blur-sm">
          {ingredient.subtitle}
        </span>
      </div>

      {/* MIDDLE/BOTTOM: Name + description + meta row */}
      <div className="relative z-10 space-y-3">
        <h3 className="text-3xl font-extrabold leading-[1.05] tracking-tight drop-shadow-sm sm:text-4xl md:text-5xl">
          {ingredient.name}
        </h3>
        <p className="max-w-xl text-sm leading-relaxed text-white/90 sm:text-base">
          {ingredient.description}
        </p>

        {/* Meta row: benefit badge + product + CTA arrow */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-3 py-1.5 text-xs font-bold backdrop-blur-sm">
            {ingredient.benefit}
          </span>
          <span className="text-xs font-medium text-white/80">
            Dalam: <span className="font-bold text-white">{ingredient.product}</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-foreground transition-transform duration-300 group-hover:translate-x-1">
            Lihat Produk <ArrowRight className="size-3" />
          </span>
        </div>
      </div>

      {/* Card index number — small, bottom-right */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-4 right-5 text-xs font-bold tabular-nums text-white/40"
      >
        {String(index + 1).padStart(2, '0')} / {String(INGREDIENTS.length).padStart(2, '0')}
      </span>
    </motion.button>
  )
}

/**
 * Sticky LEFT panel — updates as the active card changes.
 * Shows the active ingredient's index, name, and description so the user
 * always has context for the card currently in view.
 */
function StickyPanel({
  activeIdx,
  isDesktop,
}: {
  activeIdx: number
  isDesktop: boolean
}) {
  const active = INGREDIENTS[activeIdx]
  // Smoothly animate the changing content
  return (
    <div className={isDesktop ? 'md:sticky md:top-24 md:flex md:h-[80vh] md:flex-col md:justify-center' : ''}>
      <motion.div
        key={activeIdx}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        className="space-y-4"
      >
        {/* Big faded index number */}
        <div className="flex items-baseline gap-3">
          <span className="text-6xl font-extrabold tabular-nums leading-none gradient-brand-text sm:text-7xl">
            {String(activeIdx + 1).padStart(2, '0')}
          </span>
          <span className="text-lg font-bold text-muted-foreground/60 tabular-nums">
            / {String(INGREDIENTS.length).padStart(2, '0')}
          </span>
        </div>

        {/* Active ingredient name */}
        <h3 className="text-balance text-2xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-3xl">
          {active.name}
        </h3>

        {/* Subtitle eyebrow */}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          <span aria-hidden="true" className="inline-block h-px w-3 bg-primary" />
          {active.subtitle}
        </span>

        {/* Description */}
        <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          {active.description}
        </p>

        {/* Benefit + product row */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
            {active.benefit}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-3 py-1.5 text-xs font-bold text-secondary">
            {active.product}
          </span>
        </div>

        {/* Progress dots — 8 dots, active highlighted */}
        <div className="flex items-center gap-1.5 pt-2" aria-hidden="true">
          {INGREDIENTS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === activeIdx ? 'w-6 bg-primary' : 'w-1.5 bg-border'
              }`}
            />
          ))}
        </div>
      </motion.div>
    </div>
  )
}

export function IngredientsReveal() {
  const [activeIdx, setActiveIdx] = useState(0)

  // Stable callback so each card's effect doesn't re-fire when activeIdx changes.
  const handleActive = useCallback((idx: number) => setActiveIdx(idx), [])

  return (
    <section className="relative overflow-clip bg-gradient-to-b from-muted/30 to-background py-12 md:py-20">
      {/* Decorative blurred orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-20 size-80 rounded-full bg-primary/5 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 bottom-20 size-96 rounded-full bg-secondary/5 blur-3xl"
      />

      <div className="container-page relative">
        {/* Section header — full-width on mobile, only on left column on desktop */}
        <div className="mb-8 md:mb-12">
          <SectionHeader
            eyebrow="Diformulasikan dengan Sains"
            eyebrowIcon={<FlaskConical className="size-3" />}
            title={
              <>
                Bahan Aktif <span className="gradient-brand-text">Pilihan</span>
              </>
            }
            subtitle="Setiap produk Anima Companion diformulasikan dengan bahan aktif premium yang teruji klinis dan direkomendasikan dokter hewan."
            className="mb-0"
          />
        </div>

        {/* 2-column layout: sticky panel LEFT (40%) + scrolling cards RIGHT (60%) */}
        <div className="grid gap-8 md:grid-cols-[40%_60%] md:gap-10">
          {/* LEFT: Sticky panel (desktop only — hidden on mobile to save space) */}
          <div className="hidden md:block">
            <StickyPanel activeIdx={activeIdx} isDesktop />
          </div>

          {/* RIGHT: Scrolling ingredient cards */}
          <div className="space-y-6 md:space-y-8">
            {/* Mobile-only compact active indicator (above the cards) */}
            <div className="md:hidden">
              <StickyPanel activeIdx={activeIdx} isDesktop={false} />
            </div>

            {INGREDIENTS.map((ingredient, idx) => (
              <IngredientCard
                key={ingredient.name}
                ingredient={ingredient}
                index={idx}
                onActive={handleActive}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
