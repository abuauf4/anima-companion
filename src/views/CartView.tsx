'use client'

import { useHashRouter } from '@/lib/router'
import { useCartStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Image as OptImage } from '@/components/common/Image'
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react'
import { formatRupiah, effectivePrice } from '@/lib/format'

export function CartView() {
  const { navigate } = useHashRouter()
  const items = useCartStore((s) => s.items)
  const removeItem = useCartStore((s) => s.removeItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)

  // Subtotal is the sum of effective (post-sale) prices × quantity.
  // No voucher / free-shipping discount applied at the cart level anymore —
  // the customer checkout flow no longer exposes voucher input, and
  // CheckoutView no longer sends `voucherCode` to /api/orders.
  // The order total the customer sees is exactly the cart subtotal. The
  // admin still has the option to grant discounts via WhatsApp after the
  // order is submitted.
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
        <h1 className="mb-2 text-2xl font-bold">Keranjang Belanja Kosong</h1>
        <p className="mb-6 max-w-md text-muted-foreground">
          Belum ada produk di keranjang Anda. Yuk mulai belanja untuk hewan peliharaan Anda!
        </p>
        <Button size="lg" onClick={() => navigate('/produk')} className="gap-2">
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
            // Stable React key: composite of productId + variantId (or null).
            // Different variants of the same product are separate cart lines,
            // so productId alone is no longer unique within the cart.
            const lineKey = `${item.productId}::${item.variantId || ''}`
            return (
              <Card key={lineKey} className="flex gap-4 p-4">
                {/* Image */}
                <button
                  onClick={() => navigate(`/produk/${item.slug}`)}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted"
                >
                  <OptImage
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="96px"
                    className="h-full w-full object-cover"
                    brandName={item.brand}
                    slug={item.slug}
                  />
                </button>

                {/* Info */}
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        onClick={() => navigate(`/produk/${item.slug}`)}
                        className="line-clamp-2 text-left text-sm font-semibold hover:text-primary"
                      >
                        {item.name}
                      </button>
                      {/* Variant name (Phase: Variants) — shown if the cart
                          line is for a specific variant. */}
                      {item.variantName && (
                        <p className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {item.variantName}
                        </p>
                      )}
                      {item.weight && !item.variantName && (
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
                      // Remove by composite key — pass variantId so the right
                      // cart line is removed (not all lines of the product).
                      onClick={() => removeItem(item.productId, item.variantId)}
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
                        // Update by composite key — pass variantId so the
                        // right cart line is updated.
                        onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                        className="h-8 w-8 rounded-r-none"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
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
            onClick={() => navigate('/produk')}
            className="gap-2"
          >
            <ArrowRight className="h-4 w-4 rotate-180" /> Lanjut Belanja
          </Button>
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Ringkasan Pesanan</h2>

            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ({items.length} item)</span>
                <span className="font-medium">{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ongkir</span>
                <span className="text-muted-foreground">Dihitung admin via WA</span>
              </div>
            </div>

            <div className="mt-4 flex justify-between border-t border-border pt-4">
              <span className="text-base font-semibold">Total</span>
              <span className="text-xl font-bold text-primary">{formatRupiah(subtotal)}</span>
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
