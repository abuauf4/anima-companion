'use client'

import { useHashRouter } from '@/lib/router'

/**
 * Anima Companion Logo
 *
 * Visual identity (based on real brand reference):
 * - Icon: stylized paw print — 4 purple toe pads at top + 1 large orange
 *   central pad at bottom (with a small white heart cutout).
 * - Wordmark: "ANIMA COMPANION" — uppercase, bold, sans-serif.
 *   "ANIMA" in foreground color, "COMPANION" in purple.
 * - Tagline (optional): "Elevating Animal Health" — real brand tagline.
 *
 * Brand colors are inherited from Tailwind tokens (primary=orange,
 * secondary=purple) — already set in globals.css.
 */
export function Logo({ className = '', showTagline = false }: { className?: string; showTagline?: boolean }) {
  const { navigate } = useHashRouter()
  return (
    <button
      onClick={() => navigate('/')}
      className={`group flex items-center gap-2.5 ${className}`}
      aria-label="Anima Companion — ke beranda"
    >
      {/* Paw print icon */}
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center transition-transform group-hover:scale-105">
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full drop-shadow-sm"
          aria-hidden="true"
        >
          {/* 4 toe pads (purple) — arranged in a slight arc at the top */}
          <ellipse cx="14" cy="16" rx="4" ry="5.5" fill="#7C3AED" />
          <ellipse cx="23" cy="11" rx="4" ry="5.5" fill="#7C3AED" />
          <ellipse cx="32" cy="11" rx="4" ry="5.5" fill="#7C3AED" />
          <ellipse cx="34" cy="16" rx="4" ry="5.5" fill="#7C3AED" />

          {/* Central pad (orange) — large rounded shape at the bottom */}
          <path
            d="M24 22c-6 0-11 4.5-11 10.5 0 4.5 3 7.5 6 7.5 1.8 0 3-.6 4-1.2 1-.6 1.6-.6 2.6 0 1 .6 2.2 1.2 4 1.2 3 0 6-3 6-7.5 0-6-5-10.5-11-10.5z"
            fill="#F97316"
          />

          {/* Small white heart cutout in the center of the orange pad */}
          <path
            d="M24 33.2c-.7-.7-1.8-.7-2.5 0-.4.4-.5 1-.3 1.5.3.8 1.4 1.4 2.8 2.3 1.4-.9 2.5-1.5 2.8-2.3.2-.5.1-1.1-.3-1.5-.7-.7-1.8-.7-2.5 0z"
            fill="#FFFFFF"
            fillOpacity="0.92"
          />
        </svg>
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
