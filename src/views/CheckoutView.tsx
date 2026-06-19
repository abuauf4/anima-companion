'use client'

import { useState } from 'react'
import { useHashRouter } from '@/lib/router'
import { useCartStore } from '@/lib/store'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Image as OptImage } from '@/components/common/Image'
import { Check, MessageCircle, ShoppingBag, ArrowLeft, ChevronRight } from 'lucide-react'
import { formatRupiah, effectivePrice } from '@/lib/format'
import { generateWhatsAppMessage, buildWhatsAppUrl } from '@/lib/whatsapp'
import { SITE_CONFIG } from '@/lib/config'
import { toast } from 'sonner'

export function CheckoutView() {
  const { navigate } = useHashRouter()
  const { user } = useAuth()
  const items = useCartStore((s) => s.items)
  const voucherCode = useCartStore((s) => s.voucherCode)
  const clear = useCartStore((s) => s.clear)

  const [form, setForm] = useState({
    customerName: user?.name || '',
    customerPhone: user?.phone || '',
    address: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const subtotal = items.reduce(
    (sum, i) => sum + effectivePrice(i.price, i.salePrice) * i.quantity,
    0
  )

  if (items.length === 0) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-accent">
          <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Keranjang Kosong</h1>
        <p className="mb-6 text-muted-foreground">Tambahkan produk dulu sebelum checkout.</p>
        <Button onClick={() => navigate('/shop')} className="gap-2">
          Mulai Belanja <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  const handleSubmit = async () => {
    if (!form.customerName || !form.customerPhone || !form.address) {
      toast.error('Lengkapi data pengiriman terlebih dahulu')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          address: form.address,
          notes: form.notes,
          voucherCode,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Generate WhatsApp message
      const waMessage = generateWhatsAppMessage({
        orderNumber: data.order.orderNumber,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        address: form.address,
        notes: form.notes,
        items: items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: effectivePrice(i.price, i.salePrice),
          subtotal: effectivePrice(i.price, i.salePrice) * i.quantity,
        })),
        subtotal: data.order.subtotal,
        discount: data.order.discount,
        total: data.order.total,
        voucherCode: data.order.voucherCode,
      })

      const waUrl = buildWhatsAppUrl(SITE_CONFIG.whatsappNumber, waMessage)

      // Clear cart
      clear()

      // Open WhatsApp in new tab
      window.open(waUrl, '_blank')

      toast.success(`Pesanan ${data.order.orderNumber} dibuat! Mengarahkan ke WhatsApp...`)

      // Redirect to order history
      setTimeout(() => navigate('/orders'), 1000)
    } catch (e: any) {
      toast.error(e.message || 'Gagal membuat pesanan')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container-page py-6">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <button onClick={() => navigate('/cart')} className="hover:text-primary flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Keranjang
        </button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Checkout</span>
      </nav>

      <h1 className="mb-6 text-2xl font-bold md:text-3xl">Checkout</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Form */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
              Data Pengiriman
            </h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nama Lengkap <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  placeholder="Nama penerima"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="phone">Nomor WhatsApp <span className="text-destructive">*</span></Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Pesanan akan dikirim ke WhatsApp admin menggunakan nomor ini
                </p>
              </div>
              <div>
                <Label htmlFor="address">Alamat Pengiriman <span className="text-destructive">*</span></Label>
                <Textarea
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Jl. Contoh No. 123, RT 01/RW 02, Kelurahan, Kota, Provinsi, Kode Pos"
                  rows={3}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="notes">Catatan (opsional)</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Catatan tambahan untuk penjual, mis. waktu kirim, catatan kurir, dll."
                  rows={2}
                  className="mt-1.5"
                />
              </div>
            </div>
          </Card>

          {/* Payment info */}
          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
              Pembayaran
            </h2>
            <div className="rounded-lg border border-border bg-accent/30 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15 text-success">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Checkout via WhatsApp</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Setelah klik "Kirim Pesanan via WhatsApp", Anda akan diarahkan ke
                    WhatsApp admin dengan pesan otomatis berisi detail pesanan.
                    Admin akan mengkonfirmasi ketersediaan produk, ongkir, dan
                    metode pembayaran (transfer bank/e-wallet).
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="gap-1 text-success border-success/30">
                <Check className="h-3 w-3" /> 100% Aman
              </Badge>
              <span>Pembayaran setelah konfirmasi admin</span>
            </div>
          </Card>
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Ringkasan Pesanan</h2>

            {/* Items */}
            <div className="mb-4 max-h-72 space-y-3 overflow-y-auto pr-1">
              {items.map((item) => {
                const itemPrice = effectivePrice(item.price, item.salePrice)
                return (
                  <div key={item.productId} className="flex gap-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                      <OptImage
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="56px"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="line-clamp-2 text-xs font-medium">{item.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatRupiah(itemPrice)} × {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">{formatRupiah(itemPrice * item.quantity)}</p>
                  </div>
                )
              })}
            </div>

            {/* Voucher badge */}
            {voucherCode && (
              <div className="mb-3 flex items-center justify-between rounded-lg border border-success/30 bg-success/5 px-3 py-1.5">
                <span className="flex items-center gap-1.5 text-xs text-success">
                  <Check className="h-3 w-3" /> Voucher {voucherCode}
                </span>
              </div>
            )}

            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ongkir</span>
                <span className="text-muted-foreground">Dihitung admin</span>
              </div>
            </div>

            <div className="mt-4 flex justify-between border-t border-border pt-4">
              <span className="font-semibold">Estimasi Total</span>
              <span className="text-xl font-bold text-primary">{formatRupiah(subtotal)}</span>
            </div>

            <Button
              size="lg"
              className="mt-4 w-full gap-2 bg-success hover:bg-success/90"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Memproses...
                </>
              ) : (
                <>
                  <MessageCircle className="h-4 w-4" />
                  Kirim Pesanan via WhatsApp
                </>
              )}
            </Button>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Dengan mengirim pesanan, Anda setup dengan Syarat & Ketentuan kami.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
