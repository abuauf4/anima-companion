/** Format integer (Rupiah penuh) → "Rp 85.000" */
export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/** Format date → "17 Jun 2026" */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

/** Format date with time → "17 Jun 2026, 14.30" */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** Discount % from price vs salePrice */
export function discountPercent(price: number, salePrice?: number | null): number {
  if (!salePrice || salePrice >= price) return 0
  return Math.round(((price - salePrice) / price) * 100)
}

/** Effective price (salePrice if set, else price) */
export function effectivePrice(price: number, salePrice?: number | null): number {
  return salePrice && salePrice < price ? salePrice : price
}

/** Generate order number: AC-YYYYMMDD-NNN */
export function generateOrderNumber(sequence: number): string {
  const now = new Date()
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  return `AC-${ymd}-${String(sequence).padStart(3, '0')}`
}

/** Indonesian order status labels */
export const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Menunggu Konfirmasi', color: 'amber' },
  CONFIRMED: { label: 'Dikonfirmasi', color: 'blue' },
  PROCESSED: { label: 'Diproses', color: 'purple' },
  COMPLETED: { label: 'Selesai', color: 'green' },
  CANCELLED: { label: 'Dibatalkan', color: 'red' },
}

/** Indonesian pet type labels — Anima Companion only sells cat & dog supplements */
export const PET_TYPE_LABELS: Record<string, string> = {
  kucing: 'Kucing',
  anjing: 'Anjing',
}
