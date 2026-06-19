'use client'

import { useState, useEffect } from 'react'
import { useHashRouter } from '@/lib/router'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ShoppingBag, ChevronRight, MessageCircle } from 'lucide-react'
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

export function OrderHistoryView() {
  const { navigate } = useHashRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/orders')
      .then((r) => r.json())
      .then((data) => setOrders(data.orders || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="container-page py-6 space-y-3">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-accent">
          <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Belum Ada Pesanan</h1>
        <p className="mb-6 text-muted-foreground">Anda belum melakukan pesanan apa pun.</p>
        <Button onClick={() => navigate('/shop')} className="gap-2">
          Mulai Belanja <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="container-page py-6">
      <h1 className="mb-6 text-2xl font-bold md:text-3xl">Riwayat Pesanan</h1>

      <div className="space-y-3">
        {orders.map((order) => {
          const status = ORDER_STATUS[order.status] || { label: order.status, color: 'gray' }
          const isExpanded = expandedId === order.id
          return (
            <Card key={order.id} className="overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : order.id)}
                className="flex w-full items-center gap-4 p-4 text-left hover:bg-accent/30"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm font-semibold">{order.orderNumber}</p>
                    <Badge
                      className="text-[10px]"
                      style={{
                        backgroundColor: `var(--color-${status.color === 'gray' ? 'muted' : status.color}, #f3f4f6)`,
                        color: `var(--color-${status.color === 'gray' ? 'foreground' : status.color}, #374151)`,
                      }}
                    >
                      {status.label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(order.createdAt)} • {order.items.length} item
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">{formatRupiah(order.total)}</p>
                  <ChevronRight className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border bg-accent/20 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Items */}
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Item Pesanan
                      </h4>
                      <div className="space-y-2">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
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

                    {/* Address + totals */}
                    <div>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Pengiriman
                      </h4>
                      <p className="text-sm">{order.customerName}</p>
                      <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
                      <p className="text-sm text-muted-foreground">{order.address}</p>
                      {order.notes && (
                        <p className="mt-2 text-xs italic text-muted-foreground">Catatan: {order.notes}</p>
                      )}

                      <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>{formatRupiah(order.subtotal)}</span>
                        </div>
                        {order.discount > 0 && (
                          <div className="flex justify-between text-success">
                            <span>Diskon {order.voucherCode ? `(${order.voucherCode})` : ''}</span>
                            <span>-{formatRupiah(order.discount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold">
                          <span>Total</span>
                          <span className="text-primary">{formatRupiah(order.total)}</span>
                        </div>
                      </div>

                      <a
                        href={whatsappAdminUrl(`Halo Anima Companion! Saya ingin bertanya tentang pesanan ${order.orderNumber} 🐾`)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm" className="mt-3 w-full gap-2 border-success text-success hover:bg-success hover:text-success-foreground">
                          <MessageCircle className="h-3.5 w-3.5" /> Tanya Pesanan via WhatsApp
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
