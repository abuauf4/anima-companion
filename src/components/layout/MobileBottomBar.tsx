'use client'

import { useState } from 'react'
import { useHashRouter } from '@/lib/router'
import { useWishlistStore } from '@/lib/store'
import { whatsappAdminUrl } from '@/lib/config'
import { Home, ShoppingBag, Heart, Menu } from 'lucide-react'

/**
 * Mobile Bottom Bar — replacement for hamburger menu sidebar.
 *
 * 5 items (left to right):
 * 1. Home
 * 2. Produk (semua produk)
 * 3. WhatsApp (center, larger — agak gedeen)
 * 4. Wishlist (with count badge)
 * 5. Menu → opens 2 CTAs above the bar: Kucing + Anjing
 *
 * Visible on mobile only (md:hidden).
 */
export function MobileBottomBar() {
  const { route, navigate } = useHashRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const wishlistCount = useWishlistStore((s) => s.items.length)

  const isActive = (path: string) => {
    if (path === '/') return route.path === '/'
    return route.segments[0] === path
  }

  const handleMenuClick = () => {
    setMenuOpen((v) => !v)
  }

  const handlePetSelect = (slug: 'kucing' | 'anjing') => {
    navigate(`/shop?pet=${slug}`)
    setMenuOpen(false)
  }

  return (
    <>
      {/* Menu popup — 2 CTA above bottom bar (Kucing + Anjing) */}
      {menuOpen && (
        <>
          {/* Backdrop to close menu when tapping outside */}
          <button
            aria-label="Tutup menu"
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
            onClick={() => setMenuOpen(false)}
          />
          {/* Popup card with 2 CTAs */}
          <div className="fixed bottom-[88px] left-1/2 z-50 flex -translate-x-1/2 gap-3 md:hidden">
            <button
              onClick={() => handlePetSelect('kucing')}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 px-6 py-4 text-white shadow-xl shadow-orange-500/30 transition-transform active:scale-95"
            >
              <span className="text-2xl">🐈</span>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-xs font-medium text-white/80">Belanja untuk</span>
                <span className="text-base font-bold">Kucing</span>
              </div>
            </button>
            <button
              onClick={() => handlePetSelect('anjing')}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 px-6 py-4 text-white shadow-xl shadow-violet-500/30 transition-transform active:scale-95"
            >
              <span className="text-2xl">🐕</span>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-xs font-medium text-white/80">Belanja untuk</span>
                <span className="text-base font-bold">Anjing</span>
              </div>
            </button>
          </div>
        </>
      )}

      {/* Bottom bar (mobile only) */}
      <nav
        aria-label="Navigasi mobile"
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] backdrop-blur-md md:hidden"
      >
        {/* 1. Home */}
        <button
          onClick={() => navigate('/')}
          aria-label="Beranda"
          aria-current={isActive('/') ? 'page' : undefined}
          className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5"
        >
          <Home
            className={`h-5 w-5 ${isActive('/') ? 'text-primary' : 'text-muted-foreground'}`}
            strokeWidth={isActive('/') ? 2.5 : 2}
          />
          <span className={`text-[10px] font-medium ${isActive('/') ? 'text-primary' : 'text-muted-foreground'}`}>
            Beranda
          </span>
        </button>

        {/* 2. Produk */}
        <button
          onClick={() => navigate('/shop')}
          aria-label="Produk"
          aria-current={isActive('shop') ? 'page' : undefined}
          className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5"
        >
          <ShoppingBag
            className={`h-5 w-5 ${isActive('shop') ? 'text-primary' : 'text-muted-foreground'}`}
            strokeWidth={isActive('shop') ? 2.5 : 2}
          />
          <span className={`text-[10px] font-medium ${isActive('shop') ? 'text-primary' : 'text-muted-foreground'}`}>
            Produk
          </span>
        </button>

        {/* 3. WhatsApp — center, larger (agak gedeen) */}
        <a
          href={whatsappAdminUrl('Halo Anima Companion! Saya ingin bertanya tentang produk 🐾')}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat WhatsApp"
          className="flex flex-col items-center gap-0.5 px-2"
        >
          <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-500/40 ring-4 ring-card transition-transform active:scale-95">
            {/* Official WhatsApp glyph */}
            <svg viewBox="0 0 32 32" className="h-8 w-8 fill-current" aria-hidden="true">
              <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.478-1.318.13-.33.244-.73.244-1.088 0-.058 0-.144-.03-.215-.1-.172-2.434-1.39-2.678-1.39z" />
              <path d="M16.04 4h-.087C9.347 4 4.087 9.26 4.087 15.87c0 2.27.622 4.41 1.7 6.233L4 28l8.066-1.766c1.763.965 3.787 1.514 5.93 1.514h.045C24.653 27.748 30 22.488 30 15.87 30 9.26 24.74 4 16.04 4zm0 22.21h-.043c-1.93 0-3.873-.515-5.535-1.49l-.402-.243-4.66 1.276 1.247-4.553-.27-.43a9.51 9.51 0 0 1-1.49-5.115c0-5.285 4.3-9.585 9.61-9.585 2.552 0 4.97 1.018 6.787 2.836a9.55 9.55 0 0 1 2.806 6.788c0 5.285-4.3 9.585-9.614 9.585z" />
            </svg>
          </span>
          <span className="text-[10px] font-medium text-muted-foreground">WhatsApp</span>
        </a>

        {/* 4. Wishlist — with count badge, navigates to /wishlist (no login required) */}
        <button
          onClick={() => navigate('/wishlist')}
          aria-label="Wishlist"
          aria-current={isActive('wishlist') ? 'page' : undefined}
          className="relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5"
        >
          <span className="relative">
            <Heart
              className={`h-5 w-5 ${isActive('wishlist') ? 'text-primary' : 'text-muted-foreground'}`}
              strokeWidth={isActive('wishlist') ? 2.5 : 2}
            />
            {wishlistCount > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-card">
                {wishlistCount > 99 ? '99+' : wishlistCount}
              </span>
            )}
          </span>
          <span className={`text-[10px] font-medium ${isActive('wishlist') ? 'text-primary' : 'text-muted-foreground'}`}>
            Wishlist
          </span>
        </button>

        {/* 5. Menu — toggles Kucing/Anjing popup */}
        <button
          onClick={handleMenuClick}
          aria-label="Menu"
          aria-expanded={menuOpen}
          className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5"
        >
          <Menu
            className={`h-5 w-5 ${menuOpen ? 'text-primary' : 'text-muted-foreground'}`}
            strokeWidth={menuOpen ? 2.5 : 2}
          />
          <span className={`text-[10px] font-medium ${menuOpen ? 'text-primary' : 'text-muted-foreground'}`}>
            Menu
          </span>
        </button>
      </nav>
    </>
  )
}
