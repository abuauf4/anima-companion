'use client'

import { useHashRouter } from '@/lib/router'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard, Package, Tags, ShoppingCart, Users, Image as ImageIcon,
  Ticket, ChevronLeft, Store, MessageSquare, HelpCircle, Settings,
  ShieldCheck, KeyRound, LogOut,
} from 'lucide-react'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ============================================================================
// AdminLayout — permission-aware sidebar + section renderer.
//
// STAGE 3 CHANGES:
//   - Fetches the current admin session via /api/admin/auth/me on mount.
//   - For DEVELOPER: shows ALL nav items + "Setting User Admin" + "Ganti
//     Password" + "Logout".
//   - For ADMIN: shows only nav items whose `.view` permission the admin
//     has + "Ganti Password" + "Logout" (NO "Setting User Admin").
//   - For legacy customer admins (no admin session → /api/admin/auth/me
//     returns 401): shows ALL nav items (backward compat — legacy admins
//     have full access via User.role=ADMIN). NO "Setting User Admin"
//     (legacy admins don't have an AdminUser row to manage).
//   - "Ganti Password" navigates to /admin/change-password (works for
//     new-realm admins; legacy admins will be redirected to /admin/login
//     since they have no admin session — they can change their password
//     via the customer /reset-password flow instead).
//   - "Logout" calls /api/admin/auth/logout then redirects to /admin/login.
//     For legacy admins (no admin session), this is a no-op on the server
//     side (logout is idempotent) and just redirects to /admin/login.
//     LEGACY ADMINS SHOULD USE THE CUSTOMER /logout instead — but we show
//     the button anyway for discoverability during the transition.
//
// PERMISSION MAPPING:
//   Each NAV_ITEM section maps to a `<section>.view` permission key. The
//   sidebar fetches the admin's permissions from /api/admin/auth/me and
//   filters items. The SERVER re-checks every permission on every API
//   call, so a tampered client cannot escalate.
// ============================================================================

// Map each section to its required `.view` permission key.
const SECTION_PERMISSION: Record<string, string> = {
  dashboard: 'dashboard.view',
  products: 'products.view',
  categories: 'categories.view',
  orders: 'orders.view',
  customers: 'customers.view',
  banners: 'banners.view',
  testimonials: 'testimonials.view',
  faqs: 'faqs.view',
  vouchers: 'vouchers.view',
  settings: 'settings.view',
}

const NAV_ITEMS = [
  { section: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { section: 'products', label: 'Produk', icon: Package },
  { section: 'categories', label: 'Kategori', icon: Tags },
  { section: 'orders', label: 'Pesanan', icon: ShoppingCart },
  { section: 'customers', label: 'Pelanggan', icon: Users },
  { section: 'banners', label: 'Banner', icon: ImageIcon },
  { section: 'testimonials', label: 'Testimoni', icon: MessageSquare },
  { section: 'faqs', label: 'FAQ', icon: HelpCircle },
  { section: 'vouchers', label: 'Voucher', icon: Ticket },
  { section: 'settings', label: 'Pengaturan', icon: Settings },
]

interface AdminSessionInfo {
  systemRole: 'DEVELOPER' | 'ADMIN'
  permissions: string[]
}

export function AdminLayout({ section }: { section: string }) {
  const { route, navigate } = useHashRouter()
  const router = useRouter()
  const [counts, setCounts] = useState({ pending: 0 })
  const [adminInfo, setAdminInfo] = useState<AdminSessionInfo | null>(null)
  const [adminInfoLoaded, setAdminInfoLoaded] = useState(false)

  // Fetch the current admin session to determine which nav items to show.
  // If /api/admin/auth/me returns 401, the user is a legacy customer admin
  // (no admin session) — show all items for backward compat.
  const refreshAdminInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auth/me')
      if (res.ok) {
        const data = await res.json()
        setAdminInfo(data.admin)
      } else {
        // 401 or other — legacy user or no session. Show all items.
        setAdminInfo(null)
      }
    } catch {
      setAdminInfo(null)
    } finally {
      setAdminInfoLoaded(true)
    }
  }, [])

  useEffect(() => {
    refreshAdminInfo()
  }, [refreshAdminInfo])

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((d) => {
        if (d.stats) setCounts({ pending: d.stats.pendingOrders || 0 })
      })
      .catch(() => {})
  }, [route.path])

  // Determine which nav items to show.
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    // Legacy user (no admin session) — show all.
    if (!adminInfo) return true
    // Developer — show all.
    if (adminInfo.systemRole === 'DEVELOPER') return true
    // ADMIN — show only items with the required permission.
    const requiredPerm = SECTION_PERMISSION[item.section]
    if (!requiredPerm) return true
    return adminInfo.permissions.includes(requiredPerm)
  })

  // "Setting User Admin" is DEVELOPER-only.
  const showUserAdminMenu = adminInfo?.systemRole === 'DEVELOPER'

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' })
    } catch {
      // ignore — logout is idempotent
    }
    router.push('/admin/login')
  }

  const renderSection = () => {
    // "users" is the Setting User Admin section (Developer-only).
    if (section === 'users') {
      if (showUserAdminMenu) {
        return <AdminUsersView />
      }
      // Non-developer somehow reached this section — show unauthorized.
      return (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            Halaman ini hanya untuk Developer.
          </p>
        </div>
      )
    }
    switch (section) {
      case 'dashboard': return <DashboardView />
      case 'products': return <ProductsView />
      case 'categories': return <CategoriesView />
      case 'orders': return <OrdersView />
      case 'customers': return <CustomersView />
      case 'banners': return <BannersView />
      case 'testimonials': return <TestimonialsView />
      case 'faqs': return <FaqView />
      case 'vouchers': return <VouchersView />
      case 'settings': return <SettingsView />
      default: return <DashboardView />
    }
  }

  return (
    <div className="container-page py-6">
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center gap-2">
              {adminInfo?.systemRole === 'DEVELOPER' ? (
                <Badge variant="primary">DEVELOPER</Badge>
              ) : adminInfo ? (
                <Badge>ADMIN</Badge>
              ) : (
                <Badge>ADMIN</Badge>
              )}
            </div>
            <nav className="space-y-1">
              {visibleNavItems.map((item) => {
                const isActive = section === item.section
                return (
                  <button
                    key={item.section}
                    onClick={() => navigate(`/admin/${item.section === 'dashboard' ? '' : item.section}`)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {item.section === 'orders' && counts.pending > 0 && (
                      <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                        isActive ? 'bg-white/20' : 'bg-primary text-primary-foreground'
                      }`}>
                        {counts.pending}
                      </span>
                    )}
                  </button>
                )
              })}

              {/* Developer-only: Setting User Admin */}
              {showUserAdminMenu && (
                <button
                  onClick={() => navigate('/admin/users')}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    section === 'users'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span className="flex-1">Setting User Admin</span>
                </button>
              )}
            </nav>

            {/* Account actions — only for new-realm admins (not legacy customer admins). */}
            {adminInfo && (
              <div className="mt-4 space-y-1 border-t border-border pt-4">
                <button
                  onClick={() => router.push('/admin/change-password')}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-accent"
                >
                  <KeyRound className="h-4 w-4" />
                  <span className="flex-1">Ganti Password</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="flex-1">Keluar</span>
                </button>
              </div>
            )}

            <div className="mt-4 border-t border-border pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="w-full justify-start gap-2"
              >
                <Store className="h-4 w-4" /> Lihat Toko
                <ChevronLeft className="ml-auto h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0">
          {adminInfoLoaded ? (
            renderSection()
          ) : (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
              Memuat...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Badge({ children, variant }: { children: React.ReactNode; variant?: 'primary' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
      variant === 'primary' ? 'bg-primary/10 text-primary' : 'bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary'
    }`}>
      {children}
    </span>
  )
}

// Imports for views
import { DashboardView } from '@/views/admin/DashboardView'
import { ProductsView } from '@/views/admin/ProductsView'
import { CategoriesView } from '@/views/admin/CategoriesView'
import { OrdersView } from '@/views/admin/OrdersView'
import { CustomersView } from '@/views/admin/CustomersView'
import { BannersView } from '@/views/admin/BannersView'
import { TestimonialsView } from '@/views/admin/TestimonialsView'
import { FaqView } from '@/views/admin/FaqView'
import { VouchersView } from '@/views/admin/VouchersView'
import { SettingsView } from '@/views/admin/SettingsView'
import { AdminUsersView } from '@/views/admin/AdminUsersView'
