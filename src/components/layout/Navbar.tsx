'use client'

import { useState, useEffect } from 'react'
import { useHashRouter } from '@/lib/router'
import { useCartStore } from '@/lib/store'
import { Logo } from './Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import {
  ShoppingCart, Menu, Search, User, X, MessageCircle,
  ChevronDown, PawPrint, Shield, Store,
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
const PET_TYPES_MENU = [
  { name: 'Kucing', slug: 'kucing', emoji: '🐈' },
  { name: 'Anjing', slug: 'anjing', emoji: '🐕' },
  { name: 'Burung', slug: 'burung', emoji: '🐦' },
  { name: 'Ikan', slug: 'ikan', emoji: '🐟' },
  { name: 'Hewan Kecil', slug: 'hewan-kecil', emoji: '🐰' },
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

const BRANDS_MENU = [
  { name: 'Zesty Paws', slug: 'zesty-paws' },
  { name: 'Native Pet', slug: 'native-pet' },
  { name: 'Vetri Science', slug: 'vetri-science' },
  { name: 'Pet Honesty', slug: 'pet-honesty' },
  { name: 'Anima Companion', slug: 'anima-companion' },
]

export function Navbar() {
  const { route, navigate } = useHashRouter()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileSection, setMobileSection] = useState<'main' | 'pets' | 'benefits' | 'brands'>('main')
  const { user, logout } = useAuth()
  const items = useCartStore((s) => s.items)
  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0)

  // Sync search from URL
  useEffect(() => {
    if (route.segments[0] === 'shop') {
      const q = route.query.get('search') || ''
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchValue(q)
    }
  }, [route])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    navigate(`/shop?search=${encodeURIComponent(searchValue)}`)
    setSearchOpen(false)
    setMobileOpen(false)
  }

  const goShop = (key: string, value: string) => {
    navigate(`/shop?${key}=${encodeURIComponent(value)}`)
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 glass shadow-sm">
      {/* Top bar */}
      <div className="bg-gradient-to-r from-primary to-amber-500 text-white text-xs">
        <div className="container-page flex h-9 items-center justify-between">
          <p className="hidden sm:block font-medium drop-shadow-sm">
            🚚 Gratis ongkir untuk pembelian min Rp 150.000
          </p>
          <p className="sm:hidden font-medium drop-shadow-sm">Gratis ongkir min Rp 150.000 🚚</p>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline font-medium drop-shadow-sm">Senin–Sabtu, 09.00–18.00</span>
            <span className="hidden sm:inline opacity-40">|</span>
            <a
              href={`https://wa.me/${'6281234567890'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 font-semibold backdrop-blur-sm transition-colors hover:bg-white/35"
            >
              <MessageCircle className="h-3 w-3" /> Chat WhatsApp
            </a>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <div className="container-page flex h-16 items-center gap-4 md:gap-6">
        <Sheet open={mobileOpen} onOpenChange={(v) => { setMobileOpen(v); if (!v) setMobileSection('main') }}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>
                <Logo />
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-6 flex flex-col gap-1">
              {mobileSection === 'main' && (
                <>
                  <button
                    onClick={() => { navigate('/'); setMobileOpen(false) }}
                    className="flex w-full items-center justify-start rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-accent"
                  >
                    Beranda
                  </button>
                  <button
                    onClick={() => setMobileSection('pets')}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-accent"
                  >
                    <span className="flex items-center gap-2"><PawPrint className="size-4 text-primary" /> Belanja by Hewan</span>
                    <ChevronDown className="size-4 -rotate-90" />
                  </button>
                  <button
                    onClick={() => setMobileSection('benefits')}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-accent"
                  >
                    <span className="flex items-center gap-2"><Shield className="size-4 text-primary" /> Belanja by Manfaat</span>
                    <ChevronDown className="size-4 -rotate-90" />
                  </button>
                  <button
                    onClick={() => setMobileSection('brands')}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-accent"
                  >
                    <span className="flex items-center gap-2"><Store className="size-4 text-primary" /> Belanja by Brand</span>
                    <ChevronDown className="size-4 -rotate-90" />
                  </button>
                  <button
                    onClick={() => { navigate('/shop'); setMobileOpen(false) }}
                    className="flex w-full items-center justify-start rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-accent"
                  >
                    Semua Produk
                  </button>
                  <button
                    onClick={() => { navigate('/problem'); setMobileOpen(false) }}
                    className="flex w-full items-center justify-start rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-accent"
                  >
                    Shop by Problem
                  </button>
                  <button
                    onClick={() => { navigate('/kontak'); setMobileOpen(false) }}
                    className="flex w-full items-center justify-start rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-accent"
                  >
                    Konsultasi
                  </button>
                  {user && (
                    <>
                      <div className="my-2 h-px bg-border" />
                      <button
                        onClick={() => { navigate('/profile'); setMobileOpen(false) }}
                        className="flex w-full items-center justify-start rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-accent"
                      >
                        Profil Saya
                      </button>
                      <button
                        onClick={() => { navigate('/orders'); setMobileOpen(false) }}
                        className="flex w-full items-center justify-start rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-accent"
                      >
                        Riwayat Pesanan
                      </button>
                      {user.role === 'ADMIN' && (
                        <button
                          onClick={() => { navigate('/admin'); setMobileOpen(false) }}
                          className="flex w-full items-center justify-start rounded-lg px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-accent"
                        >
                          Dashboard Admin
                        </button>
                      )}
                      <button
                        onClick={() => { logout(); setMobileOpen(false) }}
                        className="flex w-full items-center justify-start rounded-lg px-3 py-2.5 text-left text-sm font-medium text-destructive hover:bg-accent"
                      >
                        Keluar
                      </button>
                    </>
                  )}
                  {!user && (
                    <>
                      <div className="my-2 h-px bg-border" />
                      <button
                        onClick={() => { navigate('/login'); setMobileOpen(false) }}
                        className="flex w-full items-center justify-start rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-accent"
                      >
                        Masuk
                      </button>
                      <button
                        onClick={() => { navigate('/register'); setMobileOpen(false) }}
                        className="flex w-full items-center justify-start rounded-lg bg-primary px-3 py-2.5 text-left text-sm font-medium text-primary-foreground"
                      >
                        Daftar
                      </button>
                    </>
                  )}
                </>
              )}

              {mobileSection === 'pets' && (
                <MobileSubmenu
                  title="Belanja by Hewan"
                  onBack={() => setMobileSection('main')}
                  items={PET_TYPES_MENU.map((p) => ({ name: `${p.emoji} ${p.name}`, slug: p.slug }))}
                  onNavigate={(slug) => { goShop('pet', slug); setMobileOpen(false) }}
                />
              )}
              {mobileSection === 'benefits' && (
                <MobileSubmenu
                  title="Belanja by Manfaat"
                  onBack={() => setMobileSection('main')}
                  items={BENEFITS_MENU.map((p) => ({ name: `${p.emoji} ${p.name}`, slug: p.slug }))}
                  onNavigate={(slug) => { goShop('problem', slug); setMobileOpen(false) }}
                />
              )}
              {mobileSection === 'brands' && (
                <MobileSubmenu
                  title="Belanja by Brand"
                  onBack={() => setMobileSection('main')}
                  items={BRANDS_MENU}
                  onNavigate={(slug) => { goShop('brand', slug); setMobileOpen(false) }}
                />
              )}
            </nav>
          </SheetContent>
        </Sheet>

        <Logo />

        {/* Desktop search */}
        <form onSubmit={handleSearch} className="hidden flex-1 max-w-md md:flex">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari vitamin, suplemen, brand..."
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
              className="w-[640px] p-4"
              sideOffset={8}
            >
              <div className="grid grid-cols-3 gap-6">
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

                {/* By Brand */}
                <div>
                  <div className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                    <Store className="size-3.5" /> By Brand
                  </div>
                  <div className="space-y-1">
                    {BRANDS_MENU.map((b) => (
                      <button
                        key={b.slug}
                        onClick={() => goShop('brand', b.slug)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                      >
                        <span className="flex size-5 items-center justify-center rounded text-[10px] font-bold text-white gradient-brand">
                          {b.name.charAt(0)}
                        </span>
                        <span className="text-foreground/80">{b.name}</span>
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

/* ============== Mobile submenu (back navigation) ============== */
function MobileSubmenu({
  title,
  onBack,
  items,
  onNavigate,
}: {
  title: string
  onBack: () => void
  items: { name: string; slug: string }[]
  onNavigate: (slug: string) => void
}) {
  return (
    <>
      <button
        onClick={onBack}
        className="mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-accent"
      >
        ← Kembali
      </button>
      <div className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-primary">
        {title}
      </div>
      {items.map((item) => (
        <button
          key={item.slug}
          onClick={() => onNavigate(item.slug)}
          className="flex w-full items-center justify-start rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-accent"
        >
          {item.name}
        </button>
      ))}
    </>
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
