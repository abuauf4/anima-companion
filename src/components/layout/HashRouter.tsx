'use client'

import { useHashRouter } from '@/lib/router'
import { useEffect } from 'react'
import { HomeView } from '@/views/HomeView'
import { ShopView } from '@/views/ShopView'
import { ProductDetailView } from '@/views/ProductDetailView'
import { CartView } from '@/views/CartView'
import { CheckoutView } from '@/views/CheckoutView'
import { LoginView } from '@/views/auth/LoginView'
import { RegisterView } from '@/views/auth/RegisterView'
import { ProfileView } from '@/views/ProfileView'
import { OrderHistoryView } from '@/views/OrderHistoryView'
import { ProblemListView } from '@/views/ProblemListView'
import { ProblemDetailView } from '@/views/ProblemDetailView'
import { ContactView } from '@/views/ContactView'
import { WishlistView } from '@/views/WishlistView'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { useAuth } from '@/hooks/use-auth'
import { useUIStore } from '@/lib/store'
import { ScrollArea } from '@/components/ui/scroll-area'

export function HashRouter() {
  const { route } = useHashRouter()
  const { user, loading } = useAuth()
  const setMobileMenuOpen = useUIStore((s) => s.setMobileMenuOpen)

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [route.path, setMobileMenuOpen])

  const [first, second, third] = route.segments

  // ==================== ADMIN ROUTES ====================
  if (first === 'admin') {
    if (loading) return <LoadingScreen />
    if (!user || user.role !== 'ADMIN') return <UnauthorizedView />
    return <AdminLayout section={second || 'dashboard'} />
  }

  // ==================== AUTHED ROUTES ====================
  if ((first === 'profile' || first === 'orders') && !loading && !user) {
    return <LoginRequiredView />
  }

  // ==================== PUBLIC ROUTES ====================
  switch (first) {
    case undefined:
      return <HomeView />
    case 'shop':
      return <ShopView />
    case 'product':
      return second ? <ProductDetailView slug={second} /> : <ShopView />
    case 'cart':
      return <CartView />
    case 'checkout':
      return <CheckoutView />
    case 'login':
      return user ? <HomeView /> : <LoginView />
    case 'register':
      return user ? <HomeView /> : <RegisterView />
    case 'profile':
      return <ProfileView />
    case 'orders':
      return <OrderHistoryView />
    case 'problem':
      return second ? <ProblemDetailView slug={second} /> : <ProblemListView />
    case 'kontak':
      return <ContactView />
    case 'wishlist':
      return <WishlistView />
    default:
      return <NotFoundView />
  }
}

function LoadingScreen() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm">Memuat...</p>
      </div>
    </div>
  )
}

function UnauthorizedView() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-5xl">🔒</div>
      <h1 className="mb-2 text-2xl font-bold">Akses Ditolak</h1>
      <p className="mb-6 max-w-md text-muted-foreground">
        Halaman ini khusus untuk admin. Silakan masuk dengan akun admin untuk melanjutkan.
      </p>
      <a
        href="#/login"
        className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Masuk sebagai Admin
      </a>
    </div>
  )
}

function LoginRequiredView() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-5xl">🐾</div>
      <h1 className="mb-2 text-2xl font-bold">Silakan Masuk</h1>
      <p className="mb-6 max-w-md text-muted-foreground">
        Anda perlu masuk terlebih dahulu untuk mengakses halaman ini.
      </p>
      <div className="flex gap-3">
        <a
          href="#/login"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Masuk
        </a>
        <a
          href="#/register"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Daftar
        </a>
      </div>
    </div>
  )
}

function NotFoundView() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 text-5xl">🐱</div>
      <h1 className="mb-2 text-2xl font-bold">Halaman Tidak Ditemukan</h1>
      <p className="mb-6 max-w-md text-muted-foreground">
        Sepertinya halaman yang Anda cari sudah tidak tersedia.
      </p>
      <a
        href="#/"
        className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Kembali ke Beranda
      </a>
    </div>
  )
}
