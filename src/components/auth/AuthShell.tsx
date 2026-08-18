'use client'

import { Logo } from '@/components/layout/Logo'

interface AuthShellProps {
  title: string
  description: string
  children: React.ReactNode
  footer?: React.ReactNode
  compact?: boolean
}

/** Shared customer auth composition: warm, compact, and mobile-first. */
export function AuthShell({ title, description, children, footer, compact = false }: AuthShellProps) {
  return (
    <div className="gradient-mesh flex min-h-[100dvh] items-start justify-center overflow-x-hidden px-4 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:items-center sm:px-6 sm:py-10">
      <div className="w-full max-w-[30rem]">
        <div className="mb-5 text-center sm:mb-6">
          <Logo className="mx-auto" />
          <h1 className="mt-4 text-[1.55rem] font-bold tracking-tight sm:mt-5 sm:text-[1.75rem]">{title}</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
        <div className={`rounded-2xl bg-card/95 p-4 shadow-[0_14px_40px_-28px_oklch(0.18_0.02_30_/_0.28)] ring-1 ring-border/60 sm:p-6 ${compact ? 'sm:max-w-[30rem]' : ''}`}>
          {children}
        </div>
        {footer}
      </div>
    </div>
  )
}
