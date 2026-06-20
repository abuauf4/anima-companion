'use client'

import { useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { FlaskConical, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useHashRouter } from '@/lib/router'
import { SectionHeader } from '@/components/common/SectionHeader'

/**
 * Active Ingredients — "Bahan Aktif Pilihan"
 *
 * Horizontal slide carousel with arrow controls (NOT scroll-triggered).
 * - Desktop: 2 cards visible per view, slide by 2 per click
 * - Mobile: 1 card per view, slide by 1 per click
 * - Card hover: subtle lift (y -4) + shadow — no over-the-top animation
 * - Click card → navigate to product detail
 */

interface Ingredient {
  name: string
  subtitle: string
  description: string
  benefit: string
  color: string
  emoji: string
  product: string
  slug: string
}

const INGREDIENTS: Ingredient[] = [
  {
    name: 'Kolostrum',
    subtitle: 'Immune Stimulant',
    description: 'Sumber imunoglobulin alami yang meningkatkan daya tahan tubuh anabul. Pertahanan terhadap infeksi virus dan bakteri. Bahan utama Felcover+.',
    benefit: 'Imunitas',
    color: 'from-orange-400 to-amber-500',
    emoji: '🛡️',
    product: 'Felcover+',
    slug: 'felcover-plus-immune-stimulant',
  },
  {
    name: 'Prebiotik',
    subtitle: 'Gut Health Booster',
    description: 'Makanan untuk bakteri baik di usus. Menyeimbangkan mikroflora pencernaan dan meningkatkan penyerapan nutrisi. Bahan utama Felcover+.',
    benefit: 'Pencernaan',
    color: 'from-emerald-400 to-teal-500',
    emoji: '🌱',
    product: 'Felcover+',
    slug: 'felcover-plus-immune-stimulant',
  },
  {
    name: 'Omega-3 (EPA & DHA)',
    subtitle: 'Wild Fish Oil',
    description: 'Asam lemak esensial dari minyak ikan murni. Membuat bulu lebat mengkilap, jaga kesehatan jantung dan otak. Kandungan utama Sioren Fish Oil.',
    benefit: 'Bulu & Kulit',
    color: 'from-cyan-400 to-blue-500',
    emoji: '🐟',
    product: 'Sioren Fish Oil',
    slug: 'sioren-fish-oil',
  },
]

export function IngredientsReveal() {
  const { navigate } = useHashRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  const scrollByCards = useCallback((dir: 1 | -1) => {
    if (!scrollRef.current) return
    const container = scrollRef.current
    // Detect desktop (md+) by container width
    const isDesktop = window.matchMedia('(min-width: 768px)').matches
    // Desktop: 2 cards per view → scroll by ~50% container width
    // Mobile: 1 card per view → scroll by ~100% card width
    const amount = isDesktop
      ? container.clientWidth * 0.5
      : container.clientWidth
    container.scrollBy({ left: dir * amount, behavior: 'smooth' })
  }, [])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const container = scrollRef.current
    const isDesktop = window.matchMedia('(min-width: 768px)').matches
    const cardsVisible = isDesktop ? 2 : 1
    const cardWidth = container.scrollWidth / INGREDIENTS.length
    // Active index = which card is leftmost visible
    const idx = Math.round(container.scrollLeft / cardWidth)
    setActiveIdx(Math.max(0, Math.min(INGREDIENTS.length - cardsVisible, idx)))
  }, [])

  const isAtStart = activeIdx === 0
  const isAtEnd = activeIdx >= INGREDIENTS.length - 2

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background via-muted/30 to-background py-10 md:py-14">
      {/* Decorative subtle blob */}
      <div className="pointer-events-none absolute -top-20 left-1/4 size-80 rounded-full bg-primary/5 blur-3xl" />

      <div className="container-page relative">
        <SectionHeader
          eyebrow="Diformulasikan dengan Sains"
          eyebrowIcon={<FlaskConical className="size-3" />}
          title={<>Bahan Aktif <span className="gradient-brand-text">Pilihan</span></>}
          subtitle="Setiap produk Anima Companion diformulasikan dengan bahan aktif premium yang teruji klinis dan direkomendasikan dokter hewan."
          action={
            <div className="hidden items-center gap-2 sm:flex">
              {/* Index indicator */}
              <span className="text-sm font-medium text-muted-foreground">
                <span className="font-bold text-foreground">{String(activeIdx + 1).padStart(2, '0')}</span>
                {' / '}
                {String(INGREDIENTS.length).padStart(2, '0')}
              </span>
              {/* Arrow controls */}
              <button
                onClick={() => scrollByCards(-1)}
                disabled={isAtStart}
                aria-label="Sebelumnya"
                className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-all hover:bg-accent disabled:opacity-40 disabled:hover:bg-card"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                onClick={() => scrollByCards(1)}
                disabled={isAtEnd}
                aria-label="Berikutnya"
                className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-all hover:bg-accent disabled:opacity-40 disabled:hover:bg-card"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          }
          className="mb-8"
        />

        {/* Carousel container */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {INGREDIENTS.map((ing, i) => (
            <motion.button
              key={ing.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: Math.min(i, 3) * 0.05 }}
              onClick={() => navigate(`/product/${ing.slug}`)}
              whileHover={{ y: -4 }}
              className={`group relative flex shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br ${ing.color} p-5 text-left text-white shadow-sm transition-shadow hover:shadow-lg md:p-6 w-full md:w-[calc(33.333%-0.667rem)]`}
              style={{ minHeight: '340px' }}
              aria-label={`Lihat produk ${ing.product}`}
            >
              {/* Top: emoji + benefit badge */}
              <div className="flex items-start justify-between">
                <span className="text-5xl drop-shadow-sm md:text-6xl">{ing.emoji}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                  {ing.benefit}
                </span>
              </div>

              {/* Bottom: text content */}
              <div className="mt-6">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/70">
                  {ing.subtitle}
                </span>
                <h3 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight drop-shadow-sm md:text-3xl">
                  {ing.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/90">
                  {ing.description}
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold">
                  <span className="rounded-md bg-white/20 px-2 py-1 backdrop-blur-sm">
                    {ing.product}
                  </span>
                  <span className="inline-flex items-center gap-1 transition-transform group-hover:translate-x-1">
                    Lihat Produk <ArrowRight className="size-3" />
                  </span>
                </div>
              </div>

              {/* Decorative big emoji background (faded) */}
              <span
                className="pointer-events-none absolute -bottom-6 -right-4 select-none text-[140px] opacity-15 transition-transform duration-300 group-hover:scale-110"
                style={{ lineHeight: 1 }}
                aria-hidden="true"
              >
                {ing.emoji}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Mobile arrow controls */}
        <div className="mt-4 flex items-center justify-between sm:hidden">
          <span className="text-sm font-medium text-muted-foreground">
            <span className="font-bold text-foreground">{String(activeIdx + 1).padStart(2, '0')}</span>
            {' / '}
            {String(INGREDIENTS.length).padStart(2, '0')}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => scrollByCards(-1)}
              disabled={isAtStart}
              aria-label="Sebelumnya"
              className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-all hover:bg-accent disabled:opacity-40 disabled:hover:bg-card"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => scrollByCards(1)}
              disabled={activeIdx >= INGREDIENTS.length - 1}
              aria-label="Berikutnya"
              className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-all hover:bg-accent disabled:opacity-40 disabled:hover:bg-card"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
