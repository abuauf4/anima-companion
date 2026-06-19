'use client'

import { MessageCircle } from 'lucide-react'
import { whatsappAdminUrl } from '@/lib/config'

export function WhatsAppFloatingButton() {
  return (
    <a
      href={whatsappAdminUrl('Halo Anima Companion! Saya ingin bertanya tentang produk 🐾')}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat WhatsApp"
      className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-success text-success-foreground shadow-lg transition-all hover:scale-110 hover:bg-success/90"
    >
      <MessageCircle className="h-7 w-7" />
      <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center">
        <span className="absolute h-full w-full animate-ping rounded-full bg-success opacity-75" />
        <span className="relative h-3 w-3 rounded-full bg-success" />
      </span>
    </a>
  )
}
