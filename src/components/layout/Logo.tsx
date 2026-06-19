'use client'

import { useHashRouter } from '@/lib/router'
import NextImage from 'next/image'

/**
 * Anima Companion Logo
 *
 * Uses the official brand logo image (/anima-logo.jpg) — circular paw print
 * (4 purple toe pads + orange central pad) on white background with subtle
 * gray decorative lines.
 *
 * The JPEG doesn't support transparency, so the container uses rounded-full
 * overflow-hidden to clip the square image into a circle — hiding the black
 * corners that would otherwise appear when the logo sits on a colored bg.
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
      {/* Logo image — circular, no black container */}
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-border/30 transition-transform group-hover:scale-105">
        <NextImage
          src="/anima-logo.jpg"
          alt="Anima Companion logo"
          width={40}
          height={40}
          className="h-full w-full object-cover"
          priority
          unoptimized
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
