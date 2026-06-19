'use client'

import { whatsappAdminUrl } from '@/lib/config'

/**
 * Floating WhatsApp button — desktop only (hidden on mobile).
 *
 * Uses the official WhatsApp brand SVG logo (not a generic chat icon).
 * Mobile users interact with WhatsApp via the bottom bar's center button.
 */
export function WhatsAppFloatingButton() {
  return (
    <a
      href={whatsappAdminUrl('Halo Anima Companion! Saya ingin bertanya tentang produk 🐾')}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat WhatsApp"
      className="fixed bottom-6 right-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-500/30 transition-all hover:scale-110 hover:bg-[#1fae54] md:flex"
    >
      {/* Official WhatsApp glyph */}
      <svg
        viewBox="0 0 32 32"
        className="h-8 w-8 fill-current"
        aria-hidden="true"
      >
        <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.478-1.318.13-.33.244-.73.244-1.088 0-.058 0-.144-.03-.215-.1-.172-2.434-1.39-2.678-1.39z" />
        <path d="M16.04 4h-.087C9.347 4 4.087 9.26 4.087 15.87c0 2.27.622 4.41 1.7 6.233L4 28l8.066-1.766c1.763.965 3.787 1.514 5.93 1.514h.045C24.653 27.748 30 22.488 30 15.87 30 9.26 24.74 4 16.04 4zm0 22.21h-.043c-1.93 0-3.873-.515-5.535-1.49l-.402-.243-4.66 1.276 1.247-4.553-.27-.43a9.51 9.51 0 0 1-1.49-5.115c0-5.285 4.3-9.585 9.61-9.585 2.552 0 4.97 1.018 6.787 2.836a9.55 9.55 0 0 1 2.806 6.788c0 5.285-4.3 9.585-9.614 9.585z" />
      </svg>
      {/* Pulsing notification dot */}
      <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center">
        <span className="absolute h-full w-full animate-ping rounded-full bg-[#25D366] opacity-75" />
        <span className="relative h-3 w-3 rounded-full bg-[#25D366] ring-2 ring-white" />
      </span>
    </a>
  )
}
