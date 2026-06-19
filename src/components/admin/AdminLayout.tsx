'use client'

import { useHashRouter } from '@/lib/router'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard, Package, Tags, ShoppingCart, Users, Image as ImageIcon,
  Ticket, ChevronLeft, Store,
} from 'lucide-react'
import { useEffect, useState } from 'react'

const NAV_ITEMS = [
  { section: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { section: 'products', label: 'Produk', icon: Package },
  { section: 'categories', label: 'Kategori', icon: Tags },
  { section: 'orders', label: 'Pesanan', icon: ShoppingCart },
  { section: 'customers', label: 'Pelanggan', icon: Users },
  { section: 'banners', label: 'Banner', icon: ImageIcon },
  { section: 'vouchers', label: 'Voucher', icon: Ticket },
]

export function AdminLayout({ section }: { section: string }) {
  const { route, navigate } = useHashRouter()
  const [counts, setCounts] = useState({ pending: 0 })

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((d) => {
        if (d.stats) setCounts({ pending: d.stats.pendingOrders || 0 })
      })
      .catch(() => {})
  }, [route.path])

  const renderSection = () => {
    switch (section) {
      case 'dashboard': return <DashboardView />
      case 'products': return <ProductsView />
      case 'categories': return <CategoriesView />
      case 'orders': return <OrdersView />
      case 'customers': return <CustomersView />
      case 'banners': return <BannersView />
      case 'vouchers': return <VouchersView />
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
              <Badge>ADMIN</Badge>
            </div>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
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
            </nav>
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
          {renderSection()}
        </div>
      </div>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
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
import { VouchersView } from '@/views/admin/VouchersView'
