'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ShoppingCart, ChevronLeft, ChevronRight, Download, RotateCcw,
} from 'lucide-react'
import { formatRupiah, formatDateTime, ORDER_STATUS } from '@/lib/format'
import { toast } from 'sonner'
import {
  AdminActionMenu, AdminEmptyState, AdminPageHeader, AdminStatusBadge,
} from '@/components/admin/AdminListPrimitives'
import { OrderDetailModal } from '@/components/admin/OrderDetailModal'
import { exportOrdersCsv, type ReceiptOrder } from '@/lib/order-receipt'

interface OrderItem {
  id: string
  productName: string
  productSku: string
  price: number
  quantity: number
  subtotal: number
  variantId?: string | null
  variantName?: string | null
}

interface Order {
  id: string
  orderNumber: string
  status: string
  customerName: string
  customerPhone: string
  address: string
  notes: string | null
  subtotal: number
  discount: number
  total: number
  voucherCode: string | null
  createdAt: string
  items: OrderItem[]
  user?: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
  } | null
}

const STATUS_FLOW = ['PENDING', 'CONFIRMED', 'PROCESSED', 'COMPLETED', 'CANCELLED']

export function OrdersView() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [fromDate, setFromDate] = useState('') // YYYY-MM-DD, WIB
  const [toDate, setToDate] = useState('') // YYYY-MM-DD, WIB
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selected, setSelected] = useState<Order | null>(null)
  const [exporting, setExporting] = useState(false)

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    params.set('page', String(page))
    const res = await fetch(`/api/admin/orders?${params.toString()}`)
    const data = await res.json()
    setOrders(data.orders || [])
    setTotalPages(data.pagination?.totalPages || 1)
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFilter, fromDate, toDate, page])

  // Reset to page 1 when any filter changes
  useEffect(() => { setPage(1) }, [statusFilter, fromDate, toDate])

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const data = await res.json()
      const updatedOrder = data.order
      // Update local state with the server's authoritative version of the
      // order (includes refreshed items + status).
      setOrders(orders.map((o) => o.id === id ? { ...o, ...updatedOrder } : o))
      if (selected?.id === id) setSelected({ ...selected, ...updatedOrder } as Order)
      toast.success(`Status pesanan diperbarui ke "${ORDER_STATUS[status]?.label || status}"`)
    } else {
      // Server rejected the transition (e.g. CANCELLED → PENDING is forbidden,
      // or unknown status value). Show the error message and reload so the
      // local UI snaps back to the authoritative server state.
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Gagal mengubah status pesanan')
      load()
    }
  }

  /**
   * Export CSV — fetch ALL orders matching the current filter (ignoring
   * pagination), then trigger a CSV download with one row per order-item.
   *
   * Uses a separate fetch (not the paginated `orders` state) because the
   * current page might only show 20 of, say, 350 matching orders.
   */
  const handleExportCsv = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter)
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      params.set('page', '1')
      params.set('limit', '1000') // generous cap; most admin exports fit

      const res = await fetch(`/api/admin/orders?${params.toString()}`)
      if (!res.ok) throw new Error('Gagal memuat data untuk export')
      const data = await res.json()
      const exportOrders: ReceiptOrder[] = (data.orders || []).map((o: Order) => ({
        orderNumber: o.orderNumber,
        status: o.status,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        customerEmail: o.user?.email || null,
        address: o.address,
        notes: o.notes,
        voucherCode: o.voucherCode,
        subtotal: o.subtotal,
        discount: o.discount,
        total: o.total,
        createdAt: o.createdAt,
        items: o.items.map((i) => ({
          productName: i.productName,
          variantName: i.variantName,
          quantity: i.quantity,
          price: i.price,
          subtotal: i.subtotal,
        })),
      }))

      if (exportOrders.length === 0) {
        toast.info('Tidak ada pesanan untuk diexport dengan filter saat ini')
        return
      }

      exportOrdersCsv(exportOrders, fromDate || undefined, toDate || undefined)
      toast.success(`Exported ${exportOrders.length} pesanan ke CSV`)
    } catch (e: any) {
      toast.error('Gagal export CSV: ' + (e?.message || e))
    } finally {
      setExporting(false)
    }
  }

  const resetFilters = () => {
    setStatusFilter('ALL')
    setFromDate('')
    setToDate('')
  }

  const hasActiveFilters = statusFilter !== 'ALL' || fromDate !== '' || toDate !== ''

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader title="Pesanan" description="Kelola pesanan pelanggan" />

      {/* Filter row: status + date range + actions */}
      <div className="space-y-3">
        {/* Status filter chips */}
        <div className="flex flex-wrap gap-2">
          {['ALL', ...STATUS_FLOW].map((s) => {
            const label = s === 'ALL' ? 'Semua' : ORDER_STATUS[s]?.label
            const isActive = statusFilter === s
            return (
              <Button
                key={s}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setStatusFilter(s) }}
              >
                {label}
              </Button>
            )
          })}
        </div>

        {/* Date range + actions */}
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Dari Tanggal
            </label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              max={toDate || undefined}
              className="h-9 w-[150px] text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sampai Tanggal
            </label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate || undefined}
              className="h-9 w-[150px] text-xs"
            />
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="gap-1.5 text-muted-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          )}
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={exporting}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? 'Mengexport...' : 'Export CSV'}
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <Card className="overflow-hidden rounded-xl shadow-none">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : orders.length === 0 ? (
          <AdminEmptyState icon={<ShoppingCart className="h-8 w-8" />} title="Belum ada pesanan" description="Pesanan baru akan muncul di sini." />
        ) : (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3 font-medium">No. Pesanan</th>
                  <th className="px-4 py-3 font-medium">Pelanggan</th>
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const status = ORDER_STATUS[o.status] || { label: o.status }
                  return (
                    <tr
                      key={o.id}
                      className="cursor-pointer border-t border-border/70 transition-colors hover:bg-muted/40"
                      onClick={() => setSelected(o)}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium">
                        {o.orderNumber}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{o.customerName}</p>
                        <p className="text-xs text-muted-foreground">{o.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</td>
                      <td className="px-4 py-3">{o.items.length} item</td>
                      <td className="px-4 py-3 font-semibold">{formatRupiah(o.total)}</td>
                      <td className="px-4 py-3">
                        <AdminStatusBadge tone={o.status === 'COMPLETED' ? 'success' : o.status === 'CANCELLED' ? 'danger' : o.status === 'PENDING' ? 'warning' : 'info'}>
                          {status.label}
                        </AdminStatusBadge>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <AdminActionMenu
                          items={[
                            { label: 'Lihat detail', onSelect: () => setSelected(o) },
                          ]}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Mobile cards */}
      {!loading && orders.length > 0 && (
        <div className="space-y-2 md:hidden">
          {orders.map((o) => {
            const status = ORDER_STATUS[o.status] || { label: o.status }
            return (
              <Card
                key={`mobile-${o.id}`}
                className="cursor-pointer rounded-xl p-3 shadow-none active:bg-muted/40"
                onClick={() => setSelected(o)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-primary">{o.orderNumber}</span>
                  <AdminStatusBadge tone={o.status === 'COMPLETED' ? 'success' : o.status === 'CANCELLED' ? 'danger' : o.status === 'PENDING' ? 'warning' : 'info'}>
                    {status.label}
                  </AdminStatusBadge>
                </div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{o.customerName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDateTime(o.createdAt)} · {o.items.length} item
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{formatRupiah(o.total)}</p>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">Halaman {page} dari {totalPages}</span>
          <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Detail modal */}
      <OrderDetailModal
        order={selected}
        onClose={() => setSelected(null)}
        onStatusChange={updateStatus}
      />
    </div>
  )
}
