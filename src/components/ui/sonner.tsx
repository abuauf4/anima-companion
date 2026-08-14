"use client"

/**
 * Sonner Toaster — the single, globally-standard toast system for the app.
 *
 * Standard usage in any client component:
 *
 *   import { toast } from 'sonner'
 *   toast.success('Berhasil')
 *   toast.error('Gagal')
 *   toast.info('Info')
 *   toast.warning('Peringatan')
 *   toast.promise(asyncFn, { loading, success, error })
 *   toast.dismiss(id?)
 *
 * DO NOT import from `@radix-ui/react-toast`, `@/components/ui/toast`,
 * `@/components/ui/toaster`, or `@/hooks/use-toast` — those modules no
 * longer exist; Sonner replaces them.
 */

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-right"
      richColors
      closeButton
      duration={4000}
      // Sonner pauses auto-dismiss on hover by default — no prop needed.
      // Mirror the design tokens so a "default" toast matches the Card look
      // (popover bg + border). `richColors` already styles success/error/info,
      // so this only affects the plain `toast(...)` variant.
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
