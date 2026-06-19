'use client'

import { useHashRouter } from '@/lib/router'

/**
 * Anima Companion Logo
 *
 * Uses SVG logo (/anima-logo.svg) — circular white background with paw print
 * (4 purple toe pads + orange central pad with white heart cutout) + subtle
 * decorative lines.
 *
 * SVG advantages over JPEG:
 * - Scalable (no pixelation on Retina/4K displays)
 * - Smaller file (~1.5K vs 10K JPEG)
 * - Crisp at any size
 * - No need for rounded-full overflow-hidden hack (SVG has transparency)
 *
 * Wordmark: "ANIMA COMPANION" — uppercase, bold, sans-serif.
 *   "ANIMA" in foreground color, "COMPANION" in purple.
 * Tagline (optional): "Elevating Animal Health" — real brand tagline.
 */
export function Logo({ className = '', showTagline = false }: { className?: string; showTagline?: boolean }) {
  const { navigate } = useHashRouter()
  return (
    <button
      onClick={() => navigate('/')}
      className={`group flex items-center gap-2.5 ${className}`}
      aria-label="Anima Companion — ke beranda"
    >
      {/* Logo SVG — scalable, crisp, lightweight */}
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-border/30 transition-transform group-hover:scale-105">
        <img
          src="/anima-logo.svg"
          alt="Anima Companion logo"
          width={40}
          height={40}
          className="h-full w-full"
          // priority loading for above-the-fold logo
          loading="eager"
        />
      </span>

      {/* Wordmark */}
      <span className="flex flex-col items-start leading-none">
        <span className="text-base font-extrabold uppercase tracking-tight text-foreground sm:text-lg">
          ANIMA <span className="text-secondary">COMPANION</span>
        </span>
        {showTagline && (
          <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Elevating Animal Health
          </span>
        )}
      </span>
    </button>
  )
}
