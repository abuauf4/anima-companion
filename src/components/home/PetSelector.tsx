'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { CatSilhouette } from '@/components/home/CatSilhouette'
import { DogSilhouette } from '@/components/home/DogSilhouette'

/**
 * PetSelector — homepage section with two floating visual CTAs:
 * Kucing (purple silhouette) and Anjing (orange silhouette).
 *
 * Design intent (Phase 1.3):
 *  - NO card container around each item. Silhouettes float directly on the
 *    warm cream homepage background.
 *  - Two columns on mobile (390px), comfortable spacing.
 *  - Idle state is fully static — no infinite animation.
 *  - Desktop hover: body translateY -3 + scale 1.02, tail subtle rotate.
 *  - Mobile tap: brief tap feedback (~200ms), then navigate. Never two taps.
 *  - Respects prefers-reduced-motion: MotionConfig reducedMotion='user'
 *    automatically strips transform/opacity animations; we still navigate
 *    instantly without waiting for the animation when reduced motion is on.
 *  - Single clickable target per item (min tap target ~88px square easily
 *    meets the 44px a11y minimum).
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
          {/* Optional small heading — kept very short and editorial.
              Can be removed if visually cleaner without it; included for
              label-on-section a11y and a soft visual anchor. */}
          <h2 className="mb-8 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground md:mb-10 md:text-xs">
            Pilih untuk siapa
          </h2>

          {/* Two-column grid. No card container — items float on background. */}
          <div className="grid grid-cols-2 items-start gap-5 md:gap-12">
            {children}
          </div>
        </div>
      </section>
    </MotionConfig>
  )
}

/**
 * PetSelectorItem — a single floating silhouette CTA.
 *
 * The whole item is a <button> so it's one clickable target with proper
 * a11y semantics. The label, arrow, and silhouette all live inside it.
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
  //  - Start navigation after ~180ms (well under the 300ms cap).
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
      }, 180)
    }
  }

  const handlePointerDown = () => {
    if (reducedRef.current) return
    setPressed(true)
    if (pressTimer.current) clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => {
      onActivate()
      pressTimer.current = null
    }, 180)
  }

  const handlePointerUpOrLeave = () => {
    // If the user released before the 180ms timer fired, cancel and reset
    // visual state (they decided not to commit the tap).
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    setPressed(false)
  }

  const isCat = type === 'cat'
  const Silhouette = isCat ? CatSilhouette : DogSilhouette
  // Brand colors: cat = secondary purple, dog = primary orange.
  const silhouetteColor = isCat
    ? 'text-[oklch(0.52_0.22_295)]'
    : 'text-[oklch(0.68_0.19_45)]'
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

  // Framer Motion variants for the silhouette container — hover/tap.
  // MotionConfig reducedMotion='user' will strip transform/opacity
  // automatically when the user has reduced motion enabled at the OS level.
  const containerVariants = {
    rest: { y: 0, scale: 1 },
    hover: {
      y: -3,
      scale: 1.02,
      transition: { duration: 0.45, ease: 'easeOut' as const },
    },
    tap: {
      y: 0,
      scale: 0.97,
      transition: { duration: 0.12 },
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
      {/* Silhouette — motion.g inside the SVG drives the body/tail hover.
          Soft ground shadow sits beneath, kept very subtle. */}
      <div className="relative flex w-full items-end justify-center">
        {/* Soft ground shadow — flat ellipse, very low opacity.
            No heavy drop-shadow, just a hint of grounding. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1 h-[6px] w-[68%] rounded-[100%] bg-foreground/10 blur-[3px]"
        />
        {/* Subtle accent glow — extremely faint, single hue.
            Not a large gradient, just a soft wash that matches the silhouette. */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-24 w-24 rounded-full opacity-20 blur-2xl ${
            isCat ? 'bg-[oklch(0.52_0.22_295)]' : 'bg-[oklch(0.68_0.19_45)]'
          }`}
        />

        {/* The silhouette itself.
            motion.div drives the container-level hover/tap; the inner
            motion.g in each silhouette SVG drives the tail rotate.
            Both share the same 'group' state via Framer's variant
            propagation (initial/rest, parent hover → child hover). */}
        <motion.div
          variants={containerVariants}
          initial="rest"
          whileHover="hover"
          whileTap={pressed ? 'tap' : 'rest'}
          animate={pressed ? 'tap' : 'rest'}
          className={`relative h-[140px] w-full max-w-[150px] ${silhouetteColor}`}
          style={{ transformOrigin: 'center bottom' }}
        >
          <Silhouette className="h-full w-full" />
        </motion.div>
      </div>

      {/* Label + arrow — below silhouette, single line, no badges. */}
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
