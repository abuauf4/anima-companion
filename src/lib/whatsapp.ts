import { formatRupiah } from './format'

export interface WhatsAppOrderData {
  orderNumber: string
  customerName: string
  customerPhone: string
  address: string
  notes?: string | null
  items: Array<{
    name: string
    quantity: number
    price: number
    subtotal: number
  }>
  subtotal: number
  discount: number
  total: number
  voucherCode?: string | null
}

/** Generate the WhatsApp message for order confirmation */
export function generateWhatsAppMessage(data: WhatsAppOrderData): string {
  const lines: string[] = []

  lines.push('*Halo Anima Companion!* 👋')
  lines.push('')
  lines.push('Saya ingin memesan produk berikut:')
  lines.push('')
  lines.push(`*No. Pesanan:* ${data.orderNumber}`)
  lines.push('')
  lines.push('━━━━━━━━━━━━━━━━━━')
  lines.push('*DETAIL PESANAN*')
  lines.push('━━━━━━━━━━━━━━━━━━')
  data.items.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.name}`)
    lines.push(`   ${item.quantity} x ${formatRupiah(item.price)} = ${formatRupiah(item.subtotal)}`)
  })
  lines.push('━━━━━━━━━━━━━━━━━━')
  lines.push(`Subtotal: ${formatRupiah(data.subtotal)}`)
  if (data.discount > 0) {
    lines.push(`Diskon${data.voucherCode ? ` (${data.voucherCode})` : ''}: -${formatRupiah(data.discount)}`)
  }
  lines.push(`*TOTAL: ${formatRupiah(data.total)}*`)
  lines.push('')
  lines.push('━━━━━━━━━━━━━━━━━━')
  lines.push('*DATA PENGIRIMAN*')
  lines.push('━━━━━━━━━━━━━━━━━━')
  lines.push(`Nama: ${data.customerName}`)
  lines.push(`No. HP: ${data.customerPhone}`)
  lines.push(`Alamat: ${data.address}`)
  if (data.notes) {
    lines.push(`Catatan: ${data.notes}`)
  }
  lines.push('')
  lines.push('Mohon konfirmasi ketersediaan produk dan total pembayaran ya. Terima kasih! 🐾')

  return lines.join('\n')
}

/** Build the wa.me URL with prefilled message */
export function buildWhatsAppUrl(phoneNumber: string, message: string): string {
  // Strip non-digits from phone, ensure starts with 62 (Indonesia)
  let phone = phoneNumber.replace(/\D/g, '')
  if (phone.startsWith('0')) {
    phone = '62' + phone.slice(1)
  } else if (!phone.startsWith('62')) {
    phone = '62' + phone
  }
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}
