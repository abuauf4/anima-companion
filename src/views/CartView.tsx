'use client'

import { useState, useEffect } from 'react'
import { useHashRouter } from '@/lib/router'
import { useCartStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Image as OptImage } from '@/components/common/Image'
import { Trash2, Plus, Minus, ShoppingBag, Tag, ArrowRight, X, Truck } from 'lucide-react'
import { formatRupiah, effectivePrice } from '@/lib/format'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

export function CartView() {
  const { navigate } = useHashRouter()
  const items = useCartStore((s) => s.items)
  const removeItem = useCartStore((s) => s.removeItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const voucherCode = useCartStore((s) => s.voucherCode)
  const setVoucher = useCartStore((s) => s.setVoucher)

  const [voucherInput, setVoucherInput] = useState(voucherCode || '')
  const [appliedVoucher, setAppliedVoucher] = useState<{
    code: string
    discount: number
    description: string | null
  } | null>(null)
  const [validating, setValidating] = useState(false)

  const subtotal = items.reduce(
    (sum, i) => sum + effectivePrice(i.price, i.salePrice) * i.quantity,
    0
  )

  // Re-validate voucher when items change
  useEffect(() => {
    if (voucherCode && items.length > 0) {
      validateVoucher(voucherCode)
    } else if (items.length === 0) {
      setAppliedVoucher(null)
    }
     
  }, [items.length])

  const validateVoucher = async (code: string) => {
    setValidating(true)
    try {
      const res = await fetch('/api/vouchers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAppliedVoucher(null)
        setVoucher(null)
        toast.error(data.error || 'Voucher tidak valid')
        return
      }
      setAppliedVoucher(data.voucher)
      setVoucher(data.voucher.code)
      toast.success(`Voucher ${data.voucher.code} diterapkan! Hemat ${formatRupiah(data.voucher.discount)}`)
    } catch {
      toast.error('Gagal memvalidasi voucher')
    } finally {
      setValidating(false)
    }
  }

  const handleApplyVoucher = () => {
    if (!voucherInput.trim()) return
    validateVoucher(voucherInput.trim().toUpperCase())
  }

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null)
    setVoucher(null)
    setVoucherInput('')
    toast.success('Voucher dihapus')
  }

  const discount = appliedVoucher?.discount || 0
  const total = Math.max(0, subtotal - discount)

  // Free shipping threshold (Rp 150.000)
  const FREE_SHIPPING_THRESHOLD = 150000
  const remainingForFreeShip = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal)
  const freeShipProgress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)
  const hasFreeShip = subtotal >= FREE_SHIPPING_THRESHOLD

  if (items.length === 0) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-accent">
          <ShoppingBag className="h-12 w-12 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-2xl font-bold">Keranjang Belanja Kosong</h1>
        <p className="mb-6 max-w-md text-muted-foreground">
          Belum ada produk di keranjang Anda. Yuk mulai belanja untuk hewan peliharaan Anda!
        </p>
        <Button size="lg" onClick={() => navigate('/shop')} className="gap-2">
          Mulai Belanja <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="container-page py-6">
      <h1 className="mb-6 text-2xl font-bold md:text-3xl">Keranjang Belanja</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Cart items */}
        <div className="space-y-3">
          {items.map((item) => {
            const itemPrice = effectivePrice(item.price, item.salePrice)
            const itemSubtotal = itemPrice * item.quantity
            return (
              <Card key={item.productId} className="flex gap-4 p-4">
                {/* Image */}
                <button
                  onClick={() => navigate(`/product/${item.slug}`)}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted"
                >
                  <OptImage
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="96px"
                    className="h-full w-full object-cover"
                  />
                </button>

                {/* Info */}
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        onClick={() => navigate(`/product/${item.slug}`)}
                        className="line-clamp-2 text-left text-sm font-semibold hover:text-primary"
                      >
                        {item.name}
                      </button>
                      {item.weight && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.weight}</p>
                      )}
                      {item.salePrice && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          <span className="line-through">{formatRupiah(item.price)}</span>{' '}
                          <span className="text-destructive">Hemat {formatRupiah(item.price - item.salePrice)}</span>
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.productId)}
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Hapus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-3">
                    {/* Quantity */}
                    <div className="flex items-center rounded-lg border border-border">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="h-8 w-8 rounded-r-none"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="h-8 w-8 rounded-l-none"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        {formatRupiah(itemPrice)} x {item.quantity}
                      </p>
                      <p className="text-base font-bold text-primary">{formatRupiah(itemSubtotal)}</p>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}

          <Button
            variant="ghost"
            onClick={() => navigate('/shop')}
            className="gap-2"
          >
            <ArrowRight className="h-4 w-4 rotate-180" /> Lanjut Belanja
          </Button>
        </div>

        {/* Free Shipping Meter — AOV booster */}
        <Card className={`overflow-hidden border-2 ${hasFreeShip ? 'border-success/40 bg-success/5' : 'border-amber-200 bg-amber-50/50'}`}>
          <div className="p-3.5">
            <div className="flex items-center gap-2.5">
              <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${hasFreeShip ? 'bg-success text-success-foreground' : 'bg-amber-400 text-white'}`}>
                <Truck className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                {hasFreeShip ? (
                  <>
                    <p className="text-sm font-bold text-success">🎉 Gratis ongkir aktif!</p>
                    <p className="text-[11px] text-success/80">Kamu berhak gratis pengiriman untuk pesanan ini.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-amber-900">
                      Belanja <span className="text-primary">{formatRupiah(remainingForFreeShip)}</span> lagi untuk gratis ongkir!
                    </p>
                    <p className="text-[11px] text-amber-700/80">Total sekarang: {formatRupiah(subtotal)} dari {formatRupiah(FREE_SHIPPING_THRESHOLD)}</p>
                  </>
                )}
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-amber-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${freeShipProgress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`h-full rounded-full ${hasFreeShip ? 'bg-success' : 'bg-gradient-to-r from-amber-400 to-primary'}`}
              />
            </div>
          </div>
        </Card>

        {/* Summary */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Ringkasan Pesanan</h2>

            {/* Voucher */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Kode Voucher
              </label>
              {appliedVoucher ? (
                <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success/5 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-success" />
                    <div>
                      <p className="text-sm font-semibold text-success">{appliedVoucher.code}</p>
                      {appliedVoucher.description && (
                        <p className="text-[10px] text-muted-foreground">{appliedVoucher.description}</p>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRemoveVoucher}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Mis. HELLO20"
                    value={voucherInput}
                    onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyVoucher()}
                    className="uppercase"
                  />
                  <Button variant="outline" onClick={handleApplyVoucher} disabled={validating || !voucherInput.trim()}>
                    {validating ? '...' : 'Pakai'}
                  </Button>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="text-[10px] text-muted-foreground">Coba:</span>
                {['HELLO20', 'HEMAT15', 'GRATISONGKIR'].map((c) => (
                  <button
                    key={c}
                    onClick={() => { setVoucherInput(c); validateVoucher(c) }}
                    className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-mono hover:bg-accent/70"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ({items.length} item)</span>
                <span className="font-medium">{formatRupiah(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-success">
                  <span>Diskon</span>
                  <span className="font-medium">-{formatRupiah(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ongkir</span>
                <span className="text-muted-foreground">Dihitung admin via WA</span>
              </div>
            </div>

            <div className="mt-4 flex justify-between border-t border-border pt-4">
              <span className="text-base font-semibold">Total</span>
              <span className="text-xl font-bold text-primary">{formatRupiah(total)}</span>
            </div>

            <Button
              size="lg"
              className="mt-4 w-full gap-2"
              onClick={() => navigate('/checkout')}
            >
              Checkout <ArrowRight className="h-4 w-4" />
            </Button>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Checkout dilanjutkan via WhatsApp. Pembayaran setelah konfirmasi admin.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
