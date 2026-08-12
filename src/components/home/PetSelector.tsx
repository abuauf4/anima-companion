'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

/**
 * PetSelector — homepage section with two open visual CTAs:
 * Kucing (purple accent) and Anjing (orange accent).
 *
 * Design intent (final artwork swap):
 *  - NO card container around each item. The transparent WebP assets
 *    float directly on the warm cream homepage background.
 *  - Uses the real photographic reference assets shipped by the user:
 *      /public/kucing.webp  (393x511, alpha)
 *      /public/anjing.webp  (377x511, alpha)
 *    We use a plain <img> (not next/image) so the assets are served
 *    byte-for-byte without re-encoding → fur / whisker detail stays
 *    crisp and transparency edges render cleanly.
 *  - Idle state is fully static — no infinite animation.
 *  - Desktop hover: scale ~1.02 + translateY -3px + subtle accent
 *    glow / drop-shadow, ~0.4s.
 *  - Mobile tap: brief scale/translate feedback, navigate after ~220ms
 *    via the parent-supplied onActivate (existing category routing).
 *  - Respects prefers-reduced-motion: MotionConfig reducedMotion='user'
 *    strips transform/opacity, and we navigate immediately on tap.
 *  - Single clickable target per item (button), keyboard accessible.
 *  - Routes are passed in by the parent (which uses the existing
 *    useHashRouter().navigate). No new router abstraction introduced.
 */
export function PetSelector({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-label="Pilih kategori hewan"
        className="bg-background px-5 py-10 md:px-8 md:py-14"
      >
        <div className="mx-auto w-full max-w-3xl">
          {/* Small editorial section heading. Visually uppercase via CSS,
              letter-spaced for an editorial feel. */}
          <h2 className="mb-8 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground md:mb-10 md:text-xs">
            Pilih untuk siapa
          </h2>

          {/* Two-column grid. No card container — pets float on background. */}
          <div className="grid grid-cols-2 items-start gap-5 md:gap-12">
            {children}
          </div>
        </div>
      </section>
    </MotionConfig>
  )
}

/**
 * PetSelectorItem — a single floating pet CTA.
 *
 * The whole item is a <button> so it's one clickable target with proper
 * a11y semantics. The label, arrow, and pet image all live inside it.
 */
export function PetSelectorItem({
  type,
  label,
  ariaLabel,
  onActivate,
}: {
  type: 'cat' | 'dog'
  label: string
  /** Descriptive label for screen readers, e.g. "Lihat produk untuk kucing". */
  ariaLabel: string
  /** Activation handler — parent wires this to useHashRouter().navigate. */
  onActivate: () => void
}) {
  // We deliberately do NOT delay navigation by a long animation on tap.
  // Strategy:
  //  - Capture tap moment visually (press scale).
  //  - Start navigation after ~220ms (within the 200–250ms range).
  //  - If user has reduced motion enabled, navigate immediately (0ms).
  const [pressed, setPressed] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reducedRef = useRef(false)

  useEffect(() => {
    // Detect prefers-reduced-motion once on mount.
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedRef.current = mq.matches
    const handler = (e: MediaQueryListEvent) => { reducedRef.current = e.matches }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Cleanup any pending navigation timer on unmount.
  useEffect(() => {
    return () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current)
        pressTimer.current = null
      }
    }
  }, [])

  const handleClick = () => {
    // If pointer already triggered the press state via onPointerDown, the
    // timer is already running. Only start a new timer if not already pressed
    // (covers keyboard activation via Enter/Space which fires onClick only).
    if (reducedRef.current) {
      // Reduced motion: navigate immediately, no press delay.
      onActivate()
      return
    }
    if (!pressed) {
      setPressed(true)
      pressTimer.current = setTimeout(() => {
        onActivate()
        // Reset pressed state after navigation starts so the visual
        // feedback is short and the item returns to rest on next mount.
        pressTimer.current = null
      }, 220)
    }
  }

  const handlePointerDown = () => {
    if (reducedRef.current) return
    setPressed(true)
    if (pressTimer.current) clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => {
      onActivate()
      pressTimer.current = null
    }, 220)
  }

  const handlePointerUpOrLeave = () => {
    // If the user released before the 220ms timer fired, cancel and reset
    // visual state (they decided not to commit the tap).
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    setPressed(false)
  }

  const isCat = type === 'cat'

  // Asset + intrinsic dimensions (used for layout-stability so the browser
  // can reserve the slot before the image loads).
  const imgSrc = isCat ? '/kucing.webp' : '/anjing.webp'
  const imgAlt = isCat ? 'Ilustrasi kucing' : 'Ilustrasi anjing'
  const intrinsicW = isCat ? 393 : 377
  const intrinsicH = 511

  // Brand accent colors:
  //  - cat = secondary purple (oklch 0.52 0.22 295)
  //  - dog = primary orange  (oklch 0.68 0.19 45)
  const labelColor = isCat
    ? 'text-[oklch(0.40_0.18_295)]'
    : 'text-[oklch(0.50_0.18_45)]'
  const arrowBg = isCat
    ? 'bg-[oklch(0.96_0.04_295)]'
    : 'bg-[oklch(0.96_0.04_60)]'
  const arrowText = isCat
    ? 'text-[oklch(0.40_0.18_295)]'
    : 'text-[oklch(0.50_0.18_45)]'
  // Tailwind ring color for keyboard focus — subtle, accent-tinted.
  const focusRing = isCat
    ? 'focus-visible:ring-[oklch(0.52_0.22_295_/_0.35)]'
    : 'focus-visible:ring-[oklch(0.68_0.19_45_/_0.35)]'
  // Accent glow color used behind the pet image on hover.
  const glowColor = isCat
    ? 'bg-[oklch(0.52_0.22_295)]'
    : 'bg-[oklch(0.68_0.19_45)]'
  // Drop-shadow filter that respects alpha — perfect for transparent WebP.
  // Slight ambient shadow on rest; lifts into an accent-tinted shadow on hover.
  // Static class strings per branch so Tailwind's JIT can see and generate them.
  const dropShadowClass = isCat
    ? 'drop-shadow-[0_10px_18px_rgba(40,20,60,0.10)] transition-[filter] duration-500 group-hover:drop-shadow-[0_18px_28px_oklch(0.52_0.22_295_/_0.28)]'
    : 'drop-shadow-[0_10px_18px_rgba(60,30,10,0.10)] transition-[filter] duration-500 group-hover:drop-shadow-[0_18px_28px_oklch(0.68_0.19_45_/_0.28)]'

  // Framer Motion variants for the image container — hover/tap.
  // MotionConfig reducedMotion='user' will strip transform/opacity
  // automatically when the user has reduced motion enabled at the OS level.
  const containerVariants = {
    rest: { y: 0, scale: 1 },
    hover: {
      y: -3,
      scale: 1.02,
      transition: { duration: 0.4, ease: 'easeOut' as const },
    },
    tap: {
      y: 0,
      scale: 0.98,
      transition: { duration: 0.14 },
    },
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUpOrLeave}
      onPointerLeave={handlePointerUpOrLeave}
      aria-label={ariaLabel}
      className={`group flex w-full flex-col items-center justify-start gap-3 rounded-2xl px-2 py-4 outline-none focus-visible:ring-2 ${focusRing} md:gap-4 md:py-6`}
    >
      {/* Pet image — motion.div drives the hover/tap. Image is rendered as
          a plain <img> to preserve the source WebP byte-for-byte (no
          re-encoding, no quality loss, transparency alpha preserved). */}
      <div className="relative flex w-full items-end justify-center">
        {/* Subtle accent glow — extremely faint, single hue, behind the
            pet image. Sits inside the column width and only brightens on
            hover so the rest state stays clean on the cream background. */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 bottom-2 mx-auto h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-25 md:h-36 md:w-36 ${glowColor}`}
        />

        {/* The pet image itself.
            - height-constrained to keep both items visually balanced
              regardless of the slightly different source aspect ratios.
            - w-auto preserves natural proportions (no stretching).
            - object-contain is a safety net for any sizing edge cases.
            - drop-shadow on the <img> respects alpha so the silhouette
              lifts cleanly off the cream background (no rectangle halo).
            - draggable=false prevents the long-press-to-save gesture on
              mobile from interfering with tap-to-navigate. */}
        <motion.div
          variants={containerVariants}
          initial="rest"
          whileHover="hover"
          whileTap={pressed ? 'tap' : 'rest'}
          animate={pressed ? 'tap' : 'rest'}
          className="relative flex h-[220px] w-auto items-end justify-center md:h-[320px]"
          style={{ transformOrigin: 'center bottom' }}
        >
          <img
            src={imgSrc}
            alt={imgAlt}
            width={intrinsicW}
            height={intrinsicH}
            draggable={false}
            loading="lazy"
            decoding="async"
            className={`h-full w-auto max-w-full select-none object-contain ${dropShadowClass}`}
          />
        </motion.div>
      </div>

      {/* Label + arrow — below image, single line, no badges. */}
      <div className="flex items-center justify-center gap-2">
        <span className={`text-base font-semibold tracking-tight md:text-lg ${labelColor}`}>
          {label}
        </span>
        {/* Circular micro-button for arrow — small, accent-tinted background. */}
        <span
          className={`flex size-6 items-center justify-center rounded-full ${arrowBg} ${arrowText} transition-transform duration-300 group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 md:size-7`}
        >
          <ArrowRight className="size-3 md:size-3.5" strokeWidth={2.5} />
        </span>
      </div>
    </button>
  )
}

/* ------------------------- exports ------------------------- */

export default PetSelector
