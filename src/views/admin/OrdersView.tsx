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
      // Update local state
      setOrders(orders.map((o) => o.id === id ? { ...o, status } : o))
      if (selected?.id === id) setSelected({ ...selected, status })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pesanan</h1>
        <p className="text-sm text-muted-foreground">Kelola pesanan pelanggan</p>
      </div>

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
      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingCart className="mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-sm font-medium">Belum ada pesanan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-accent/50">
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
                    <tr key={o.id} className="border-t border-border hover:bg-accent/20">
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
                        <Badge variant="outline" className="text-[10px]">{status.label}</Badge>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
