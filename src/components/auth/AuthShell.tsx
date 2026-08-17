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
    <div className="gradient-mesh flex min-h-[calc(100vh-9rem)] items-start justify-center py-8 sm:py-12">
      <div className="container-page w-full">
        <div className={`mx-auto w-full ${compact ? 'max-w-[30rem]' : 'max-w-[27rem]'}`}>
          <div className="mb-6 text-center">
            <Logo className="mx-auto" />
            <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-[1.75rem]">{title}</h1>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <div className="rounded-2xl bg-card/90 p-5 shadow-[0_16px_50px_-24px_oklch(0.18_0.02_30_/_0.28)] ring-1 ring-border/70 backdrop-blur-sm sm:p-6">
            {children}
          </div>
          {footer}
        </div>
      </div>
    </div>
  )
}
