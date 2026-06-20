'use client'

import { useState } from 'react'
import { useHashRouter } from '@/lib/router'
import { useWishlistStore } from '@/lib/store'
import { whatsappAdminUrl } from '@/lib/config'
import { Home, ShoppingBag, User, Menu, Heart, ChevronRight, PawPrint, Shield, Stethoscope, MessageCircle } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAuth } from '@/hooks/use-auth'

/**
 * Mobile Bottom Bar — thinner, 5 items.
 *
 * Items: Home - Produk - WhatsApp (center, bigger) - Akun - Menu (opens sidebar)
 *
 * Visible on mobile only (md:hidden).
 */
export function MobileBottomBar() {
  const { route, navigate } = useHashRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const wishlistCount = useWishlistStore((s) => s.items.length)
  const { user, logout } = useAuth()

  const isActive = (path: string) => {
    if (path === '/') return route.path === '/'
    return route.segments[0] === path
  }

  const navLinks = [
    { label: 'Beranda', path: '/', icon: Home },
    { label: 'Semua Produk', path: '/shop', icon: ShoppingBag },
    { label: 'Belanja untuk Kucing', path: '/shop?pet=kucing', icon: PawPrint },
    { label: 'Belanja untuk Anjing', path: '/shop?pet=anjing', icon: PawPrint },
    { label: 'Shop by Problem', path: '/problem', icon: Shield },
    { label: 'Konsultasi', path: '/kontak', icon: MessageCircle },
    { label: 'Wishlist', path: '/wishlist', icon: Heart, badge: wishlistCount },
  ]

  return (
    <>
      {/* Sidebar (opened by Menu button in bottom bar) */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="right" className="w-72 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <nav className="mt-6 flex flex-col gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon
              return (
                <button
                  key={link.path}
                  onClick={() => {
                    navigate(link.path)
                    setSidebarOpen(false)
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-accent"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="size-4 text-muted-foreground" />
                    {link.label}
                    {link.badge && link.badge > 0 ? (
                      <span className="flex size-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                        {link.badge}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              )
            })}

            <div className="my-2 h-px bg-border" />

            {user ? (
              <>
                <button
                  onClick={() => { navigate('/profile'); setSidebarOpen(false) }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-accent"
                >
                  <User className="size-4 text-muted-foreground" /> Profil Saya
                </button>
                <button
                  onClick={() => { navigate('/orders'); setSidebarOpen(false) }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-accent"
                >
                  <ShoppingBag className="size-4 text-muted-foreground" /> Riwayat Pesanan
                </button>
                {user.role === 'ADMIN' && (
                  <button
                    onClick={() => { navigate('/admin'); setSidebarOpen(false) }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-primary hover:bg-accent"
                  >
                    <Stethoscope className="size-4" /> Dashboard Admin
                  </button>
                )}
                <button
                  onClick={() => { logout(); setSidebarOpen(false) }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-destructive hover:bg-accent"
                >
                  Keluar
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { navigate('/login'); setSidebarOpen(false) }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-accent"
                >
                  <User className="size-4 text-muted-foreground" /> Masuk
                </button>
                <button
                  onClick={() => { navigate('/register'); setSidebarOpen(false) }}
                  className="flex w-full items-center gap-3 rounded-lg rounded-lg bg-primary px-3 py-3 text-left text-sm font-medium text-primary-foreground"
                >
                  Daftar
                </button>
              </>
            )}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Bottom bar (mobile only) — thinner */}
      <nav
        aria-label="Navigasi mobile"
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1.5 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] backdrop-blur-md md:hidden"
      >
        {/* 1. Home */}
        <button
          onClick={() => navigate('/')}
          aria-label="Beranda"
          aria-current={isActive('/') ? 'page' : undefined}
          className="flex flex-1 flex-col items-center gap-0.5 py-1"
        >
          <Home
            className={`h-[18px] w-[18px] ${isActive('/') ? 'text-primary' : 'text-muted-foreground'}`}
            strokeWidth={isActive('/') ? 2.5 : 2}
          />
          <span className={`text-[9px] font-medium ${isActive('/') ? 'text-primary' : 'text-muted-foreground'}`}>
            Home
          </span>
        </button>

        {/* 2. Produk */}
        <button
          onClick={() => navigate('/shop')}
          aria-label="Produk"
          aria-current={isActive('shop') ? 'page' : undefined}
          className="flex flex-1 flex-col items-center gap-0.5 py-1"
        >
          <ShoppingBag
            className={`h-[18px] w-[18px] ${isActive('shop') ? 'text-primary' : 'text-muted-foreground'}`}
            strokeWidth={isActive('shop') ? 2.5 : 2}
          />
          <span className={`text-[9px] font-medium ${isActive('shop') ? 'text-primary' : 'text-muted-foreground'}`}>
            Produk
          </span>
        </button>

        {/* 3. WhatsApp — center, larger */}
        <a
          href={whatsappAdminUrl('Halo Anima Companion! Saya ingin bertanya tentang produk 🐾')}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat WhatsApp"
          className="flex flex-col items-center gap-0.5 px-1"
        >
          <span className="-mt-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-500/30 ring-[3px] ring-card transition-transform active:scale-95">
            <svg viewBox="0 0 32 32" className="h-6 w-6 fill-current" aria-hidden="true">
              <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.478-1.318.13-.33.244-.73.244-1.088 0-.058 0-.144-.03-.215-.1-.172-2.434-1.39-2.678-1.39z" />
              <path d="M16.04 4h-.087C9.347 4 4.087 9.26 4.087 15.87c0 2.27.622 4.41 1.7 6.233L4 28l8.066-1.766c1.763.965 3.787 1.514 5.93 1.514h.045C24.653 27.748 30 22.488 30 15.87 30 9.26 24.74 4 16.04 4zm0 22.21h-.043c-1.93 0-3.873-.515-5.535-1.49l-.402-.243-4.66 1.276 1.247-4.553-.27-.43a9.51 9.51 0 0 1-1.49-5.115c0-5.285 4.3-9.585 9.614-9.585 2.552 0 4.97 1.018 6.787 2.836a9.55 9.55 0 0 1 2.806 6.788c0 5.285-4.3 9.585-9.614 9.585z" />
            </svg>
          </span>
          <span className="text-[9px] font-medium text-muted-foreground">Chat</span>
        </a>

        {/* 4. Akun */}
        <button
          onClick={() => navigate(user ? '/profile' : '/login')}
          aria-label="Akun"
          aria-current={isActive('profile') ? 'page' : undefined}
          className="flex flex-1 flex-col items-center gap-0.5 py-1"
        >
          <User
            className={`h-[18px] w-[18px] ${isActive('profile') || isActive('login') ? 'text-primary' : 'text-muted-foreground'}`}
            strokeWidth={isActive('profile') || isActive('login') ? 2.5 : 2}
          />
          <span className={`text-[9px] font-medium ${isActive('profile') || isActive('login') ? 'text-primary' : 'text-muted-foreground'}`}>
            Akun
          </span>
        </button>

        {/* 5. Menu — opens sidebar */}
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Menu"
          aria-expanded={sidebarOpen}
          className="flex flex-1 flex-col items-center gap-0.5 py-1"
        >
          <Menu
            className={`h-[18px] w-[18px] ${sidebarOpen ? 'text-primary' : 'text-muted-foreground'}`}
            strokeWidth={sidebarOpen ? 2.5 : 2}
          />
          <span className={`text-[9px] font-medium ${sidebarOpen ? 'text-primary' : 'text-muted-foreground'}`}>
            Menu
          </span>
        </button>
      </nav>
    </>
  )
}
