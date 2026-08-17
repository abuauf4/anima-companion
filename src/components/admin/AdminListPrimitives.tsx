'use client'

import type { ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type StatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

const statusTones: Record<StatusTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-red-200 bg-red-50 text-red-700',
  neutral: 'border-border bg-muted/60 text-muted-foreground',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
}

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function AdminStatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: StatusTone
}) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-4', statusTones[tone])}>
      {children}
    </span>
  )
}

export function AdminActionMenu({
  items,
}: {
  items: Array<{ label: string; onSelect: () => void; destructive?: boolean }>
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Buka menu aksi">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {items.map((item) => (
          <DropdownMenuItem key={item.label} onSelect={item.onSelect} className={item.destructive ? 'text-destructive focus:text-destructive' : ''}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AdminEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <Card className="flex min-h-44 flex-col items-center justify-center border-dashed bg-muted/10 px-4 py-8 text-center shadow-none">
      <div className="mb-3 text-muted-foreground">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  )
}
