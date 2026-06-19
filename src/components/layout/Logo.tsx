'use client'

import { useHashRouter } from '@/lib/router'

export function Logo({ className = '', showTagline = false }: { className?: string; showTagline?: boolean }) {
  const { navigate } = useHashRouter()
  return (
    <button
      onClick={() => navigate('/')}
      className={`group flex items-center gap-2.5 ${className}`}
      aria-label="Anima Companion — ke beranda"
    >
      <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl gradient-brand text-white font-bold text-lg shadow-sm transition-transform group-hover:scale-105">
        A
        <span className="pointer-events-none absolute -right-1 -top-1 h-3 w-3 rounded-full bg-white/30 blur-[2px]" />
      </span>
      <span className="flex flex-col items-start leading-none">
        <span className="text-base font-bold tracking-tight text-foreground sm:text-lg">
          Anima <span className="gradient-brand-text">Companion</span>
        </span>
        {showTagline && (
          <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Healthy Pets, Happy Companions
          </span>
        )}
      </span>
    </button>
  )
}
