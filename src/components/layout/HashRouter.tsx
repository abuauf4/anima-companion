'use client'

import { useHashRouter } from '@/lib/router'
import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '@/hooks/use-auth'
import { useUIStore } from '@/lib/store'

// Lazy load all route views — each becomes a separate JS chunk.
// This keeps the initial bundle small (only HomeView loads on first paint).
// Admin views (with recharts ~200K) only load when /admin is visited.
// Auth/order/profile views only load when those routes are accessed.

const HomeView = dynamic(() => import('@/views/HomeView').then(m => ({ default: m.HomeView })), {
  loading: () => <LoadingScreen />,
})
const ShopView = dynamic(() => import('@/views/ShopView').then(m => ({ default: m.ShopView })), {
  loading: () => <LoadingScreen />,
})
const ProductDetailView = dynamic(() => import('@/views/ProductDetailView').then(m => ({ default: m.ProductDetailView })), {
  loading: () => <LoadingScreen />,
})
const CartView = dynamic(() => import('@/views/CartView').then(m => ({ default: m.CartView })), {
  loading: () => <LoadingScreen />,
})
const CheckoutView = dynamic(() => import('@/views/CheckoutView').then(m => ({ default: m.CheckoutView })), {
  loading: () => <LoadingScreen />,
})
const LoginView = dynamic(() => import('@/views/auth/LoginView').then(m => ({ default: m.LoginView })), {
  loading: () => <LoadingScreen />,
})
const RegisterView = dynamic(() => import('@/views/auth/RegisterView').then(m => ({ default: m.RegisterView })), {
  loading: () => <LoadingScreen />,
})
const ProfileView = dynamic(() => import('@/views/ProfileView').then(m => ({ default: m.ProfileView })), {
  loading: () => <LoadingScreen />,
})
const OrderHistoryView = dynamic(() => import('@/views/OrderHistoryView').then(m => ({ default: m.OrderHistoryView })), {
  loading: () => <LoadingScreen />,
})
const ProblemListView = dynamic(() => import('@/views/ProblemListView').then(m => ({ default: m.ProblemListView })), {
  loading: () => <LoadingScreen />,
})
const ProblemDetailView = dynamic(() => import('@/views/ProblemDetailView').then(m => ({ default: m.ProblemDetailView })), {
  loading: () => <LoadingScreen />,
})
const ContactView = dynamic(() => import('@/views/ContactView').then(m => ({ default: m.ContactView })), {
  loading: () => <LoadingScreen />,
})
const WishlistView = dynamic(() => import('@/views/WishlistView').then(m => ({ default: m.WishlistView })), {
  loading: () => <LoadingScreen />,
})

// Admin layout — biggest win: recharts (~200K) + all admin views
// only load when admin navigates to /admin/*
const AdminLayout = dynamic(() => import('@/components/admin/AdminLayout').then(m => ({ default: m.AdminLayout })), {
  loading: () => <LoadingScreen />,
})

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
