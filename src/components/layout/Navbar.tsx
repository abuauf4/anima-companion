'use client'

import { useState, useEffect } from 'react'
import { useHashRouter } from '@/lib/router'
import { useCartStore } from '@/lib/store'
import { Logo } from './Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  ShoppingCart, Search, User, X,
  ChevronDown, PawPrint, Shield,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Static mega-menu data — kept inline for fast load & no extra fetch
// Anima Companion only sells cat & dog supplements
const PET_TYPES_MENU = [
  { name: 'Kucing', slug: 'kucing', emoji: '🐈' },
  { name: 'Anjing', slug: 'anjing', emoji: '🐕' },
]

const BENEFITS_MENU = [
  { name: 'Imunitas', slug: 'imunitas', emoji: '🛡️' },
  { name: 'Nafsu Makan', slug: 'nafsu-makan', emoji: '🍗' },
  { name: 'Bulu & Kulit', slug: 'bulu-dan-kulit', emoji: '✨' },
  { name: 'Tulang & Sendi', slug: 'tulang-dan-sendi', emoji: '🦴' },
  { name: 'Pencernaan', slug: 'pencernaan', emoji: '🌱' },
  { name: 'Mata', slug: 'mata', emoji: '👁️' },
  { name: 'Recovery', slug: 'recovery', emoji: '💖' },
  { name: 'Harian', slug: 'harian', emoji: '☀️' },
]

export function Navbar() {
  const { route, navigate } = useHashRouter()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const { user, logout } = useAuth()
  const items = useCartStore((s) => s.items)
  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0)

  // Sync search from URL
  useEffect(() => {
    if (route.segments[0] === 'shop') {
      const q = route.query.get('search') || ''
       
      setSearchValue(q)
    }
  }, [route])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    navigate(`/shop?search=${encodeURIComponent(searchValue)}`)
    setSearchOpen(false)
  }

  const goShop = (key: string, value: string) => {
    navigate(`/shop?${key}=${encodeURIComponent(value)}`)
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 glass shadow-sm">
      {/* Main nav */}
      <div className="container-page flex h-16 items-center gap-4 md:gap-6">
        <Logo />

        {/* Desktop search */}
        <form onSubmit={handleSearch} className="hidden flex-1 max-w-md md:flex">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari suplemen, vitamin, perawatan..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-9 bg-card"
            />
          </div>
        </form>

        {/* Desktop nav with mega-menu */}
        <nav className="hidden items-center gap-1 md:flex">
          <button
            onClick={() => navigate('/')}
            className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-foreground"
          >
            Beranda
          </button>

          {/* Mega-menu: Belanja */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-foreground">
                Belanja
                <ChevronDown className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[480px] p-4"
              sideOffset={8}
            >
              <div className="grid grid-cols-2 gap-6">
                {/* By Pet */}
                <div>
                  <div className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                    <PawPrint className="size-3.5" /> By Pet
                  </div>
                  <div className="space-y-1">
                    {PET_TYPES_MENU.map((p) => (
                      <button
                        key={p.slug}
                        onClick={() => goShop('pet', p.slug)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                      >
                        <span className="text-base">{p.emoji}</span>
                        <span className="text-foreground/80">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* By Benefit */}
                <div>
                  <div className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                    <Shield className="size-3.5" /> By Benefit
                  </div>
                  <div className="space-y-1">
                    {BENEFITS_MENU.map((p) => (
                      <button
                        key={p.slug}
                        onClick={() => goShop('problem', p.slug)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                      >
                        <span className="text-base">{p.emoji}</span>
                        <span className="text-foreground/80">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-lg bg-accent/60 px-4 py-2.5">
                <span className="text-xs text-muted-foreground">
                  💡 Tidak yakin? Coba lihat <span className="font-semibold text-foreground">Best Seller</span> kami.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={() => goShop('bestSeller', '1')}
                >
                  Lihat <ArrowRightSmall />
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={() => navigate('/problem')}
            className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-foreground"
          >
            Shop by Problem
          </button>
          <button
            onClick={() => navigate('/kontak')}
            className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-foreground"
          >
            Konsultasi
          </button>
        </nav>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen((v) => !v)}
            className="md:hidden"
            aria-label="Cari"
          >
            {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Akun">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  Profil Saya
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/orders')}>
                  Riwayat Pesanan
                </DropdownMenuItem>
                {user.role === 'ADMIN' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/admin')} className="text-primary font-medium">
                      Dashboard Admin
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="text-destructive">
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => navigate('/login')} aria-label="Masuk">
              <User className="h-5 w-5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => navigate('/cart')}
            aria-label="Keranjang"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <Badge className="absolute -right-1 -top-1 h-5 min-w-[20px] px-1.5 text-[10px] bg-primary text-primary-foreground">
                {cartCount > 99 ? '99+' : cartCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Mobile search sheet */}
      {searchOpen && (
        <div className="md:hidden border-t border-border bg-card">
          <form onSubmit={handleSearch} className="container-page py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Cari produk..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
          </form>
        </div>
      )}
    </header>
  )
}

function ArrowRightSmall() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}
