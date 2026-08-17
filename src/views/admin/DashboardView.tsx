'use client'

import { useEffect, useState } from 'react'
import { useHashRouter } from '@/lib/router'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  DollarSign, ShoppingCart, Users, Package, TrendingUp, Clock, ChevronRight, ArrowUp, ArrowDown,
} from 'lucide-react'
import { formatRupiah, formatDateTime, ORDER_STATUS } from '@/lib/format'

interface DashboardData {
  stats: {
    totalRevenue: number
    totalOrders: number
    totalCustomers: number
    totalProducts: number
    monthlyRevenue: number
    revenueGrowth: number
    pendingOrders: number
  }
  recentOrders: any[]
  topProducts: any[]
  salesByProblem: Array<{
    id: string
    name: string
    slug: string
    color: string | null
    revenue: number
    sold: number
  }>
}

export function DashboardView() {
  const { navigate } = useHashRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    )
  }

  const { stats, recentOrders, topProducts, salesByProblem } = data

  const pieData = salesByProblem.filter((p) => p.revenue > 0).map((p) => ({
    name: p.name,
    value: p.revenue,
    color: p.color || '#888',
  }))

  return (
    <div className="flex flex-col space-y-4 md:space-y-6">
      <div>
        <p className="text-sm font-semibold text-foreground">Ringkasan hari ini</p>
        <p className="mt-1 text-sm text-muted-foreground">Pantau aktivitas toko dan pekerjaan yang perlu ditindaklanjuti.</p>
      </div>

      {/* Keep the primary metric prominent while making the supporting stats scan quickly on mobile. */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <StatCard
          title="Total Pendapatan"
          value={formatRupiah(stats.totalRevenue)}
          icon={DollarSign}
          trend={stats.revenueGrowth}
          trendLabel="vs bulan lalu"
          color="primary"
          className="col-span-3 sm:col-span-2 lg:col-span-1"
        />
        <StatCard
          title="Pesanan"
          value={String(stats.totalOrders)}
          icon={ShoppingCart}
          subValue={`${stats.pendingOrders} menunggu`}
          color="secondary"
          compact
        />
        <StatCard
          title="Pelanggan"
          value={String(stats.totalCustomers)}
          icon={Users}
          color="success"
          compact
        />
        <StatCard
          title="Produk"
          value={String(stats.totalProducts)}
          icon={Package}
          color="primary"
          compact
        />
      </div>

      {/* Charts */}
      <div className="order-2 grid gap-4 lg:order-1 lg:gap-6 lg:grid-cols-2">
        {/* Sales by Problem */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Penjualan per Problem</h2>
              <p className="text-xs text-muted-foreground">Pendapatan berdasarkan kategori masalah</p>
            </div>
          </div>
          {pieData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Belum ada data penjualan
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={(entry: any) => entry.name}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatRupiah(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Top Products */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Produk Terlaris</h2>
              <p className="text-xs text-muted-foreground">Berdasarkan jumlah terjual</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/products')} className="gap-1">
              Lihat Semua <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          {topProducts.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Belum ada data penjualan
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topProducts.map((p) => ({ name: p.name, sold: p.sold }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="sold" fill="#F97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Recent Orders */}
      <Card className="order-1 p-4 lg:order-2 lg:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Pesanan Terbaru</h2>
            <p className="text-xs text-muted-foreground">5 pesanan terakhir</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/orders')} className="gap-1">
            Lihat Semua <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
        {recentOrders.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Belum ada pesanan
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">No. Pesanan</th>
                  <th className="pb-2 pr-4 font-medium">Pelanggan</th>
                  <th className="pb-2 pr-4 font-medium">Tanggal</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => {
                  const status = ORDER_STATUS[o.status] || { label: o.status, color: 'gray' }
                  return (
                    <tr key={o.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-4 font-mono text-xs font-medium">{o.orderNumber}</td>
                      <td className="py-3 pr-4">{o.customerName}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className="text-[10px]">{status.label}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold">{formatRupiah(o.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function StatCard({
  title, value, icon: Icon, trend, trendLabel, subValue, color, compact, className,
}: {
  title: string
  value: string
  icon: any
  trend?: number
  trendLabel?: string
  subValue?: string
  color: 'primary' | 'secondary' | 'success'
  compact?: boolean
  className?: string
}) {
  const colorClass = {
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary/10 text-secondary',
    success: 'bg-success/10 text-success',
  }[color]

  return (
    <Card className={`rounded-lg p-3 shadow-none sm:rounded-xl sm:p-5 sm:shadow-sm ${className || ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`font-medium text-muted-foreground ${compact ? 'text-[10px] leading-tight sm:text-xs' : 'text-xs uppercase tracking-wide'}`}>{title}</p>
          <p className={`mt-1 truncate font-bold ${compact ? 'text-xl sm:text-2xl' : 'text-xl sm:text-2xl'}`}>{value}</p>
          {subValue && (
            <p className={`mt-1 truncate text-muted-foreground ${compact ? 'text-[10px] sm:text-xs' : 'text-xs'}`}>{subValue}</p>
          )}
          {trend !== undefined && (
            <div className="mt-2 flex items-center gap-1 text-xs">
              {trend >= 0 ? (
                <span className="flex items-center gap-0.5 text-success">
                  <ArrowUp className="h-3 w-3" /> {trend}%
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-destructive">
                  <ArrowDown className="h-3 w-3" /> {Math.abs(trend)}%
                </span>
              )}
              <span className="text-muted-foreground">{trendLabel}</span>
            </div>
          )}
        </div>
        <div className={`flex shrink-0 items-center justify-center rounded-lg ${compact ? 'h-7 w-7 sm:h-10 sm:w-10' : 'h-9 w-9 sm:h-10 sm:w-10'} ${colorClass}`}>
          <Icon className={compact ? 'h-3.5 w-3.5 sm:h-5 sm:w-5' : 'h-4 w-4 sm:h-5 sm:w-5'} />
        </div>
      </div>
    </Card>
  )
}
