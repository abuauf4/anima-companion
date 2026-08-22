'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { ShoppingCart, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react'
import { formatRupiah, formatDateTime, ORDER_STATUS } from '@/lib/format'
import { whatsappAdminUrl } from '@/lib/config'
import { toast } from 'sonner'
import { AdminActionMenu, AdminEmptyState, AdminPageHeader, AdminStatusBadge } from '@/components/admin/AdminListPrimitives'

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
  items: Array<{
    id: string
    productName: string
    productSku: string
    price: number
    quantity: number
    subtotal: number
    // Variant snapshot (Phase: Variants)
    variantId?: string | null
    variantName?: string | null
  }>
}

const STATUS_FLOW = ['PENDING', 'CONFIRMED', 'PROCESSED', 'COMPLETED', 'CANCELLED']

export function OrdersView() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selected, setSelected] = useState<Order | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/orders?status=${statusFilter}&page=${page}`)
    const data = await res.json()
    setOrders(data.orders || [])
    setTotalPages(data.pagination?.totalPages || 1)
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFilter, page])

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
      if (selected?.id === id) setSelected({ ...selected, ...updatedOrder })
    } else {
      // Server rejected the transition (e.g. CANCELLED → PENDING is forbidden,
      // or unknown status value). Show the error message and reload so the
      // local UI snaps back to the authoritative server state.
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Gagal mengubah status pesanan')
      load()
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader title="Pesanan" description="Kelola pesanan pelanggan" />

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {['ALL', ...STATUS_FLOW].map((s) => {
          const label = s === 'ALL' ? 'Semua' : ORDER_STATUS[s]?.label
          const isActive = statusFilter === s
          return (
            <Button
              key={s}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter(s); setPage(1) }}
            >
              {label}
            </Button>
          )
        })}
      </div>

      {/* Table */}
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
                  const status = ORDER_STATUS[o.status] || { label: o.status, color: 'gray' }
                  return (
                    <tr key={o.id} className="border-t border-border/70 transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3 font-mono text-xs font-medium">
                        <button onClick={() => setSelected(o)} className="hover:text-primary hover:underline">
                          {o.orderNumber}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{o.customerName}</p>
                        <p className="text-xs text-muted-foreground">{o.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</td>
                      <td className="px-4 py-3">{o.items.length} item</td>
                      <td className="px-4 py-3 font-semibold">{formatRupiah(o.total)}</td>
                      <td className="px-4 py-3">
                        <AdminStatusBadge tone={o.status === 'COMPLETED' ? 'success' : o.status === 'CANCELLED' ? 'danger' : o.status === 'PENDING' ? 'warning' : 'info'}>{status.label}</AdminStatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={o.status}
                          onValueChange={(v) => updateStatus(o.id, v)}
                        >
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_FLOW.map((s) => (
                              <SelectItem key={s} value={s} className="text-xs">
                                {ORDER_STATUS[s].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!loading && orders.length > 0 && <div className="space-y-2 md:hidden">
        {orders.map((o) => {
          const status = ORDER_STATUS[o.status] || { label: o.status }
          return <Card key={`mobile-${o.id}`} className="rounded-xl p-3 shadow-none">
            <div className="flex items-start justify-between gap-2"><button onClick={() => setSelected(o)} className="font-mono text-xs font-semibold text-primary">{o.orderNumber}</button><AdminActionMenu items={[{ label: 'Lihat detail', onSelect: () => setSelected(o) }]} /></div>
            <div className="mt-2 flex items-end justify-between gap-3"><div><p className="text-sm font-medium">{o.customerName}</p><p className="text-[11px] text-muted-foreground">{formatDateTime(o.createdAt)} · {o.items.length} item</p></div><p className="text-sm font-semibold">{formatRupiah(o.total)}</p></div>
            <div className="mt-2 flex items-center justify-between gap-2"><AdminStatusBadge tone={o.status === 'COMPLETED' ? 'success' : o.status === 'CANCELLED' ? 'danger' : o.status === 'PENDING' ? 'warning' : 'info'}>{status.label}</AdminStatusBadge><Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}><SelectTrigger className="h-7 w-28 text-[11px]"><SelectValue /></SelectTrigger><SelectContent>{STATUS_FLOW.map((s) => <SelectItem key={s} value={s} className="text-xs">{ORDER_STATUS[s].label}</SelectItem>)}</SelectContent></Select></div>
          </Card>
        })}
      </div>}

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

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="admin-mobile-dialog max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-1rem)] overflow-y-auto p-4 top-4 translate-y-0 sm:top-[50%] sm:max-h-[90vh] sm:max-w-2xl sm:translate-y-[-50%] sm:p-6">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono">{selected.orderNumber}</DialogTitle>
                <DialogDescription>
                  {formatDateTime(selected.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Status */}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Status</p>
                  <Select value={selected.status} onValueChange={(v) => updateStatus(selected.id, v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_FLOW.map((s) => (
                        <SelectItem key={s} value={s}>{ORDER_STATUS[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Customer */}
                <div className="rounded-lg border border-border bg-accent/30 p-4">
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Data Pengiriman</p>
                  <p className="font-medium">{selected.customerName}</p>
                  <p className="text-sm">{selected.customerPhone}</p>
                  <p className="text-sm text-muted-foreground">{selected.address}</p>
                  {selected.notes && <p className="mt-2 text-xs italic">Catatan: {selected.notes}</p>}
                </div>

                {/* Items */}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Item Pesanan</p>
                  <div className="space-y-2">
                    {selected.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm border-b border-border/60 pb-2 last:border-0">
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          {item.variantName && (
                            <p className="text-xs text-primary font-medium">
                              Varian: {item.variantName}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} × {formatRupiah(item.price)}
                          </p>
                        </div>
                        <p className="font-medium">{formatRupiah(item.subtotal)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="space-y-1 border-t border-border pt-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatRupiah(selected.subtotal)}</span>
                  </div>
                  {selected.discount > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Diskon {selected.voucherCode ? `(${selected.voucherCode})` : ''}</span>
                      <span>-{formatRupiah(selected.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold">
                    <span>Total</span>
                    <span className="text-primary">{formatRupiah(selected.total)}</span>
                  </div>
                </div>

                <a
                  href={whatsappAdminUrl(`Halo ${selected.customerName}, terkait pesanan ${selected.orderNumber} di Anima Companion 🐾`)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="w-full gap-2 border-success text-success hover:bg-success hover:text-success-foreground">
                    <MessageCircle className="h-4 w-4" /> Hubungi Pelanggan via WhatsApp
                  </Button>
                </a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
