'use client'

import { useEffect, useState, useCallback } from 'react'
import { useHashRouter } from '@/lib/router'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Package, Tags, ShoppingCart, Users, Image as ImageIcon,
  Ticket, Store, MessageSquare, HelpCircle, Settings, ShieldCheck,
  KeyRound, LogOut, Menu, X, ChevronRight,
} from 'lucide-react'
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

const SECTION_PERMISSION: Record<string, string> = {
  dashboard: 'dashboard.view', products: 'products.view', categories: 'categories.view',
  orders: 'orders.view', customers: 'customers.view', banners: 'banners.view',
  testimonials: 'testimonials.view', faqs: 'faqs.view', vouchers: 'vouchers.view', settings: 'settings.view',
}

const GROUPS = [
  { label: 'Utama', items: [{ section: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'Operasional', items: [
    { section: 'products', label: 'Produk', icon: Package }, { section: 'categories', label: 'Kategori', icon: Tags },
    { section: 'orders', label: 'Pesanan', icon: ShoppingCart }, { section: 'customers', label: 'Pelanggan', icon: Users },
  ] },
  { label: 'Konten', items: [
    { section: 'banners', label: 'Banner', icon: ImageIcon }, { section: 'testimonials', label: 'Testimoni', icon: MessageSquare },
    { section: 'faqs', label: 'FAQ', icon: HelpCircle },
  ] },
  { label: 'Promo', items: [{ section: 'vouchers', label: 'Voucher', icon: Ticket }] },
  { label: 'Sistem', items: [{ section: 'settings', label: 'Pengaturan', icon: Settings }] },
]

interface AdminSessionInfo {
  systemRole: 'DEVELOPER' | 'ADMIN'
  permissions: string[]
  displayName?: string
  username?: string
}

const TITLES: Record<string, [string, string]> = {
  dashboard: ['Dashboard', 'Ringkasan operasional Anima Companion'], products: ['Produk', 'Kelola katalog dan ketersediaan produk'],
  categories: ['Kategori', 'Atur struktur kategori produk'], orders: ['Pesanan', 'Pantau dan proses pesanan pelanggan'],
  customers: ['Pelanggan', 'Lihat dan kelola data pelanggan'], banners: ['Banner', 'Kelola materi promosi di toko'],
  testimonials: ['Testimoni', 'Kelola cerita pelanggan'], faqs: ['FAQ', 'Atur pertanyaan yang sering ditanyakan'],
  vouchers: ['Voucher', 'Kelola promo dan kode voucher'], settings: ['Pengaturan', 'Kelola konfigurasi toko'],
  users: ['User Admin', 'Kelola akun dan akses internal Anima Companion'],
}

export function AdminLayout({ section }: { section: string }) {
  const { route, navigate } = useHashRouter()
  const router = useRouter()
  const [adminInfo, setAdminInfo] = useState<AdminSessionInfo | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pending, setPending] = useState(0)

  const refreshAdminInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auth/me')
      if (res.ok) {
        const data = await res.json()
        setAdminInfo(data.admin)
      }
    } catch { /* shell remains usable while session refreshes */ }
    finally { setLoaded(true) }
  }, [])

  useEffect(() => { refreshAdminInfo() }, [refreshAdminInfo])
  useEffect(() => {
    fetch('/api/admin/dashboard').then((r) => r.json()).then((d) => setPending(d.stats?.pendingOrders || 0)).catch(() => {})
  }, [route.path])

  const canSee = (name: string) => !adminInfo || adminInfo.systemRole === 'DEVELOPER' || adminInfo.permissions.includes(SECTION_PERMISSION[name])
  const isDeveloper = adminInfo?.systemRole === 'DEVELOPER'
  const title = TITLES[section] || TITLES.dashboard

  const go = (next: string) => {
    navigate(`/admin/${next === 'dashboard' ? '' : next}`)
    setDrawerOpen(false)
  }

  const logout = async () => {
    try { await fetch('/api/admin/auth/logout', { method: 'POST' }) } catch { /* idempotent */ }
    router.push('/admin/login')
  }

  const renderSection = () => {
    if (section === 'users') return isDeveloper ? <AdminUsersView /> : <EmptyPanel text="Halaman ini hanya untuk Developer." />
    switch (section) {
      case 'products': return <ProductsView />; case 'categories': return <CategoriesView />; case 'orders': return <OrdersView />
      case 'customers': return <CustomersView />; case 'banners': return <BannersView />; case 'testimonials': return <TestimonialsView />
      case 'faqs': return <FaqView />; case 'vouchers': return <VouchersView />; case 'settings': return <SettingsView />
      default: return <DashboardView />
    }
  }

  const nav = (mobile = false) => (
    <nav className={mobile ? 'space-y-5' : 'space-y-5'}>
      {GROUPS.map((group) => {
        const items = group.items.filter((item) => canSee(item.section))
        if (!items.length) return null
        return <div key={group.label}>
          <p className="admin-nav-label">{group.label}</p>
          <div className="mt-1 space-y-0.5">{items.map((item) => {
            const active = section === item.section
            const Icon = item.icon
            return <button key={item.section} onClick={() => go(item.section)} className={`admin-nav-item ${active ? 'is-active' : ''}`}>
              <Icon className="h-4 w-4 shrink-0" /><span className="flex-1 text-left">{item.label}</span>
              {item.section === 'orders' && pending > 0 && <span className="admin-count">{pending}</span>}
            </button>
          })}</div>
        </div>
      })}
      {isDeveloper && <div><p className="admin-nav-label">Developer only</p><button onClick={() => go('users')} className={`admin-nav-item ${section === 'users' ? 'is-active' : ''}`}><ShieldCheck className="h-4 w-4" /><span className="flex-1 text-left">User Admin</span></button></div>}
    </nav>
  )

  const account = <div className="admin-account">
    <div className="flex items-center gap-2.5"><div className="admin-avatar">{(adminInfo?.displayName || adminInfo?.username || 'A').slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{adminInfo?.displayName || adminInfo?.username || 'Admin Anima'}</p><p className="text-xs text-muted-foreground">{isDeveloper ? 'Developer' : 'Admin'}</p></div></div>
    {adminInfo && <div className="mt-3 grid grid-cols-2 gap-1"><button className="admin-account-action" onClick={() => router.push('/admin/change-password')}><KeyRound className="h-3.5 w-3.5" /> Password</button><button className="admin-account-action text-destructive" onClick={logout}><LogOut className="h-3.5 w-3.5" /> Keluar</button></div>}
  </div>

  return <div className="flex min-h-screen">
    <aside className="admin-sidebar hidden lg:flex"><div className="admin-brand"><div className="admin-brand-mark">A</div><div><p className="text-sm font-extrabold tracking-tight">ANIMA</p><p className="text-[10px] font-semibold tracking-[0.18em] text-secondary">COMPANION</p></div></div><div className="admin-console-label">Admin Console</div><div className="flex-1 overflow-y-auto px-3 py-5">{nav()}</div><div className="px-3 pb-3">{account}<button onClick={() => navigate('/')} className="admin-store-link"><Store className="h-4 w-4" /> Lihat Toko <ChevronRight className="ml-auto h-4 w-4" /></button></div></aside>
    <div className="flex min-w-0 flex-1 flex-col"><header className="admin-topbar"><div className="flex min-w-0 items-center gap-3"><button className="admin-menu-button lg:hidden" aria-label="Buka menu" onClick={() => setDrawerOpen(true)}><Menu className="h-5 w-5" /></button><div className="min-w-0"><h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">{title[0]}</h1><p className="hidden truncate text-xs text-muted-foreground sm:block">{title[1]}</p></div></div><div className="flex items-center gap-2"><span className="hidden text-right sm:block"><span className="block text-xs font-semibold">{adminInfo?.displayName || adminInfo?.username || 'Admin Anima'}</span><span className="block text-[11px] text-muted-foreground">{isDeveloper ? 'Developer' : 'Admin'}</span></span><div className="admin-avatar small">{(adminInfo?.displayName || adminInfo?.username || 'A').slice(0, 1).toUpperCase()}</div></div></header><main className="admin-content">{loaded ? renderSection() : <LoadingPanel />}</main></div>
    {drawerOpen && <div className="admin-drawer-backdrop lg:hidden" onClick={() => setDrawerOpen(false)}><aside className="admin-drawer" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between px-5 py-4"><div className="admin-brand"><div className="admin-brand-mark">A</div><div><p className="text-sm font-extrabold">ANIMA</p><p className="text-[10px] font-semibold tracking-[0.18em] text-secondary">COMPANION</p></div></div><button className="admin-menu-button" onClick={() => setDrawerOpen(false)} aria-label="Tutup menu"><X className="h-5 w-5" /></button></div><div className="admin-console-label px-5">Admin Console</div><div className="flex-1 overflow-y-auto px-3 py-5">{nav(true)}</div><div className="border-t border-border px-3 py-3">{account}</div></aside></div>}
  </div>
}

function LoadingPanel() { return <div className="space-y-4"><div className="h-8 w-48 animate-pulse rounded bg-muted" /><div className="h-24 animate-pulse rounded-xl bg-muted" /><div className="h-64 animate-pulse rounded-xl bg-muted" /></div> }
function EmptyPanel({ text }: { text: string }) { return <div className="admin-empty"><ShieldCheck className="h-8 w-8 text-secondary" /><p className="mt-3 font-semibold">{text}</p></div> }
