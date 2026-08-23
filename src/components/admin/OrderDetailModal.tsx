'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { MessageCircle, Printer, Download, X } from 'lucide-react'
import { formatRupiah, formatDateTime, ORDER_STATUS } from '@/lib/format'
import { whatsappAdminUrl } from '@/lib/config'
import { toast } from 'sonner'
import {
  generateReceiptPdf,
  printReceipt,
  type ReceiptOrder,
} from '@/lib/order-receipt'

/**
 * OrderDetailModal — full detail view for a single order.
 *
 * Contents:
 *   - Header: order number, date/time, status badge, close button (from Dialog)
 *   - Customer: name, phone, email (if available), address (if available)
 *   - Items: product name, variant name (if any), qty, unit price, subtotal
 *   - Summary: subtotal, discount (if any), shipping (if any), total
 *   - Status management: Select to transition order status
 *   - Actions:
 *       - Hubungi Pelanggan (WhatsApp)
 *       - Cetak Struk (browser print → dedicated receipt layout)
 *       - Download PDF (jsPDF → binary PDF download)
 *
 * Props:
 *   - order: the order to display, or null to close the modal.
 *   - onClose: closes the modal.
 *   - onStatusChange: called when admin changes the order status. The
 *       parent is responsible for persisting the change to the API and
 *       refreshing local state — this component is purely presentational
 *       + fires the request via the parent's callback.
 */

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

interface OrderDetailModalProps {
  order: Order | null
  onClose: () => void
  onStatusChange: (orderId: string, newStatus: string) => Promise<void>
}

export function OrderDetailModal({ order, onClose, onStatusChange }: OrderDetailModalProps) {
  if (!order) return null

  const status = ORDER_STATUS[order.status] || { label: order.status, color: 'gray' }
  const tone =
    order.status === 'COMPLETED' ? 'success' :
    order.status === 'CANCELLED' ? 'danger' :
    order.status === 'PENDING' ? 'warning' : 'info'

  // Map to the receipt payload shape.
  const receiptPayload: ReceiptOrder = {
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.user?.email || null,
    address: order.address,
    notes: order.notes,
    voucherCode: order.voucherCode,
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    createdAt: order.createdAt,
    items: order.items.map((i) => ({
      productName: i.productName,
      variantName: i.variantName,
      quantity: i.quantity,
      price: i.price,
      subtotal: i.subtotal,
    })),
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      await onStatusChange(order.id, newStatus)
    } catch (e: any) {
      toast.error(e?.message || 'Gagal mengubah status')
    }
  }

  const handlePrint = () => {
    try {
      printReceipt(receiptPayload)
    } catch (e: any) {
      toast.error('Gagal mencetak struk: ' + (e?.message || e))
    }
  }

  const handlePdf = () => {
    try {
      generateReceiptPdf(receiptPayload)
    } catch (e: any) {
      toast.error('Gagal membuat PDF: ' + (e?.message || e))
    }
  }

  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        // Three-layer scroll architecture:
        //   1. Outer shell (DialogContent): flex flex-col overflow-hidden max-h
        //   2. Header (shrink-0): always visible — order number, date, status
        //   3. Scrollable body (flex-1 min-h-0 overflow-y-auto): all order detail
        //   4. Sticky footer (shrink-0): WhatsApp, Cetak Struk, Download PDF
        //
        // This ensures bottom actions are ALWAYS reachable regardless of content
        // height or viewport size. The scrollable body handles overflow; the
        // footer stays pinned at the bottom of the modal.
        className="sm:max-w-3xl"
      >
        {/* === LAYER 1: Fixed header === */}
        <DialogHeader className="shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="font-mono text-base sm:text-lg">
                {order.orderNumber}
              </DialogTitle>
              <DialogDescription>
                {formatDateTime(order.createdAt)}
              </DialogDescription>
            </div>
            <Badge
              className={
                tone === 'success' ? 'bg-emerald-500 text-white' :
                tone === 'danger' ? 'bg-rose-500 text-white' :
                tone === 'warning' ? 'bg-amber-500 text-white' :
                'bg-sky-500 text-white'
              }
            >
              {status.label}
            </Badge>
          </div>
        </DialogHeader>

        {/* === LAYER 2: Scrollable content body === */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-4">
          {/* Status management */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Status Pesanan
            </p>
            <Select value={order.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FLOW.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ORDER_STATUS[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer */}
          <div className="rounded-lg border border-border bg-accent/30 p-4">
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Data Pengiriman
            </p>
            <p className="font-medium">{order.customerName}</p>
            <p className="text-sm">{order.customerPhone}</p>
            {order.user?.email && (
              <p className="text-sm text-muted-foreground">{order.user.email}</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">{order.address}</p>
            {order.notes && (
              <p className="mt-2 text-xs italic text-muted-foreground">
                Catatan: {order.notes}
              </p>
            )}
          </div>

          {/* Items */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Item Pesanan
            </p>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.productName}</p>
                    {item.variantName && (
                      <p className="text-xs font-medium text-primary">
                        Varian: {item.variantName}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {formatRupiah(item.price)}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium">{formatRupiah(item.subtotal)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatRupiah(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>
                  Diskon{order.voucherCode ? ` (${order.voucherCode})` : ''}
                </span>
                <span>-{formatRupiah(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span className="text-primary">{formatRupiah(order.total)}</span>
            </div>
          </div>
        </div>

        {/* === LAYER 3: Sticky action footer === */}
        <div className="shrink-0 border-t border-border bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="grid gap-2 sm:grid-cols-3">
            <a
              href={whatsappAdminUrl(
                `Halo ${order.customerName}, terkait pesanan ${order.orderNumber} di Anima Companion 🐾`
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                className="w-full gap-2 border-success text-success hover:bg-success hover:text-success-foreground"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
            </a>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4" /> Cetak Struk
            </Button>
            <Button
              className="w-full gap-2"
              onClick={handlePdf}
            >
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
