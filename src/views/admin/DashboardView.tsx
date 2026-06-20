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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Ringkasan performa toko Anima Companion</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Pendapatan"
          value={formatRupiah(stats.totalRevenue)}
          icon={DollarSign}
          trend={stats.revenueGrowth}
          trendLabel="vs bulan lalu"
          color="primary"
        />
        <StatCard
          title="Total Pesanan"
          value={String(stats.totalOrders)}
          icon={ShoppingCart}
          subValue={`${stats.pendingOrders} menunggu konfirmasi`}
          color="secondary"
        />
        <StatCard
          title="Total Pelanggan"
          value={String(stats.totalCustomers)}
          icon={Users}
          color="success"
        />
        <StatCard
          title="Total Produk"
          value={String(stats.totalProducts)}
          icon={Package}
          color="primary"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
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
      <Card className="p-6">
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
  title, value, icon: Icon, trend, trendLabel, subValue, color,
}: {
  title: string
  value: string
  icon: any
  trend?: number
  trendLabel?: string
  subValue?: string
  color: 'primary' | 'secondary' | 'success'
}) {
  const colorClass = {
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary/10 text-secondary',
    success: 'bg-success/10 text-success',
  }[color]

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {subValue && (
            <p className="mt-1 text-xs text-muted-foreground">{subValue}</p>
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
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  )
}
