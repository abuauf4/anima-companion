'use client'

import { Logo } from '@/components/layout/Logo'

interface AuthShellProps {
  title: string
  description: string
  children: React.ReactNode
  footer?: React.ReactNode
  compact?: boolean
  surface?: boolean
}

/** Shared customer auth composition: warm, compact, and mobile-first. */
export function AuthShell({ title, description, children, footer, compact = false, surface = true }: AuthShellProps) {
  return (
    <div className="relative isolate flex min-h-[100dvh] items-start justify-center overflow-x-hidden bg-[radial-gradient(circle_at_8%_8%,oklch(0.95_0.045_52_/_0.7),transparent_32%),radial-gradient(circle_at_94%_88%,oklch(0.95_0.04_295_/_0.65),transparent_34%),oklch(0.99_0.002_80)] px-4 py-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:items-center sm:px-6 sm:py-10">
      <span aria-hidden="true" className="pointer-events-none absolute -left-16 top-28 -z-10 h-40 w-40 rounded-full border-[18px] border-primary/5" />
      <span aria-hidden="true" className="pointer-events-none absolute -right-20 bottom-20 -z-10 h-52 w-52 rounded-full border-[22px] border-secondary/5" />
      <div className={`relative w-full ${compact ? 'max-w-[29rem]' : 'max-w-[30rem]'}`}>
        <div className="mb-6 text-center sm:mb-7">
          <Logo className="mx-auto" />
          <h1 className="mt-5 text-[1.7rem] font-bold tracking-[-0.025em] text-foreground sm:text-[1.9rem]">{title}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
        <div className={surface ? 'rounded-2xl bg-card/95 p-4 shadow-[0_14px_40px_-28px_oklch(0.18_0.02_30_/_0.28)] ring-1 ring-border/60 sm:p-6' : 'mx-auto w-full max-w-[28rem]'}>
          {children}
        </div>
        {footer}
      </div>
    </div>
  )
}
