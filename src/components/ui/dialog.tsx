"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        // Three-layer scroll architecture:
        //   1. Outer shell: overflow-hidden, flex-col, max-h on ALL breakpoints
        //      (not just sm+). The outer shell NEVER scrolls itself — it clips.
        //   2. Caller puts header (shrink-0) + scrollable body (flex-1
        //      min-h-0 overflow-y-auto) + optional footer (shrink-0) inside.
        //   3. The scrollable body handles all vertical scrolling.
        //
        // Why overflow-hidden (not overflow-y-auto) on the outer shell:
        //   Previously the outer shell had overflow-y-auto + NO max-h on mobile.
        //   This meant the modal could grow taller than the viewport, pushing
        //   bottom actions (Cetak Struk, Download PDF) off-screen with no way
        //   to scroll to them. By using overflow-hidden + flex-col + max-h
        //   on the outer shell, the shell stays within the viewport, and
        //   the inner scrollable body handles content that exceeds the
        //   available height.
        //
        // Mobile positioning: top-4, left-1/2, -translate-x-1/2.
        //   max-h: calc(100dvh - 2rem) — 16px top margin + 16px bottom margin.
        // Desktop (sm+): top-1/2, -translate-y-1/2 (centered).
        //   max-h: 90dvh.
        //
        // Why NO raw CSS `transform` override: Tailwind v4 composes transforms
        //   via CSS variables (--tw-translate-x/y) into a single `transform`
        //   property. A raw `transform: translateX(-50%)` rule (like the old
        //   .admin-mobile-dialog CSS) silently overrides the composed transform,
        //   dropping the Y translation and causing the modal to appear
        //   off-center. Using only Tailwind utilities keeps the composition intact.
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed left-1/2 top-4 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col gap-4 overflow-hidden rounded-lg border p-4 shadow-lg duration-200 sm:left-1/2 sm:top-1/2 sm:max-h-[90dvh] sm:max-w-lg sm:-translate-y-1/2 sm:p-6",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
