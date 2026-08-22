'use client'

import jsPDF from 'jspdf'
import { formatRupiah, formatDateTime, ORDER_STATUS } from '@/lib/format'

/**
 * Order shape consumed by the receipt generators.
 * Matches the Order interface in OrdersView + AdminOrderItem.
 */
export interface ReceiptOrder {
  orderNumber: string
  status: string
  customerName: string
  customerPhone: string
  customerEmail?: string | null
  address?: string | null
  notes?: string | null
  voucherCode?: string | null
  subtotal: number
  discount: number
  shipping?: number
  total: number
  createdAt: string
  items: Array<{
    productName: string
    variantName?: string | null
    quantity: number
    price: number
    subtotal: number
  }>
}

const BRAND = {
  name: 'Anima Companion',
  legalName: 'PT Sutan Vet Medika',
  tagline: 'Elevating Animal Health',
  address: 'Gedung STP - IPB lt 1, Bogor, Jawa Barat',
  email: 'sutanvetmedika@gmail.com',
  whatsapp: '0822 1084 6408',
}

/**
 * Build the receipt layout in a jsPDF doc and return the doc (caller triggers save).
 *
 * Layout (A4 portrait, 210mm x 297mm):
 *   - Header: brand name centered, tagline, address, divider
 *   - Title: "STRUK PESANAN" centered
 *   - Order meta: order number, date/time, status
 *   - Customer block: name, phone, email (if available), address (if available)
 *   - Items table: product name + variant (if any), qty x unit price, line subtotal
 *   - Summary: subtotal, discount (if any), shipping (if any), total
 *   - Footer: thank-you message
 *
 * The same layout is used for both "Cetak Struk" (browser print) and
 * "Download PDF" (jsPDF save). Print uses an HTML rendering of the same
 * data (see printReceipt function); PDF uses jsPDF's programmatic API.
 *
 * Why two code paths: jsPDF generates a real binary PDF that downloads
 * directly. Print uses the browser's native print pipeline, which can
 * also save as PDF but requires the user to pick the "Save as PDF"
 * destination in the print dialog. Both are provided so the user can
 * choose: "Download PDF" = instant file download; "Cetak Struk" = full
 * print dialog with paper-printer option.
 */
export function generateReceiptPdf(order: ReceiptOrder) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = 210
  const margin = 16
  const contentW = pageW - margin * 2
  let y = 20

  // ----- Header -----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(BRAND.name, pageW / 2, y, { align: 'center' })
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text(BRAND.tagline, pageW / 2, y, { align: 'center' })
  y += 4
  doc.text(BRAND.address, pageW / 2, y, { align: 'center' })
  y += 4
  doc.text(`${BRAND.email} · ${BRAND.whatsapp}`, pageW / 2, y, { align: 'center' })
  y += 6

  // Divider
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  // ----- Title -----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  doc.text('STRUK PESANAN', pageW / 2, y, { align: 'center' })
  y += 8

  // ----- Order meta -----
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const meta = [
    `No. Pesanan : ${order.orderNumber}`,
    `Tanggal    : ${formatDateTime(order.createdAt)}`,
    `Status      : ${ORDER_STATUS[order.status]?.label || order.status}`,
  ]
  for (const line of meta) {
    doc.text(line, margin, y)
    y += 5
  }
  y += 4

  // ----- Customer -----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('DATA PELANGGAN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const custLines = [
    `Nama    : ${order.customerName}`,
    `No HP   : ${order.customerPhone}`,
    ...(order.customerEmail ? [`Email   : ${order.customerEmail}`] : []),
    ...(order.address ? [`Alamat  : ${order.address}`] : []),
  ]
  for (const line of wrapLines(doc, custLines, contentW)) {
    doc.text(line, margin, y)
    y += 5
  }
  y += 4

  // ----- Items table -----
  doc.setFont('helvetica', 'bold')
  doc.text('ITEM PESANAN', margin, y)
  y += 5

  // Column widths: name (left, ~110mm), qty×price (right-aligned, ~50mm), subtotal (right-aligned, ~30mm)
  const nameW = 110
  const qtyW = 40
  const subW = contentW - nameW - qtyW // ~32mm

  // Header row
  doc.setFillColor(245, 245, 245)
  doc.rect(margin, y - 4, contentW, 7, 'F')
  doc.setFontSize(9)
  doc.text('Produk', margin + 2, y, { baseline: 'middle' })
  doc.text('Qty × Harga', margin + nameW + qtyW, y, { align: 'right', baseline: 'middle' })
  doc.text('Subtotal', margin + contentW, y, { align: 'right', baseline: 'middle' })
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  for (const item of order.items) {
    const nameLines = doc.splitTextToSize(item.productName, nameW - 4)
    const variantLine = item.variantName ? `Varian: ${item.variantName}` : null
    const qtyPriceLine = `${item.quantity} × ${formatRupiah(item.price)}`
    const subtotalLine = formatRupiah(item.subtotal)

    // Page break if needed
    if (y + (nameLines.length + (variantLine ? 1 : 0)) * 5 > 270) {
      doc.addPage()
      y = 20
    }

    // Name (may wrap multiple lines)
    doc.text(nameLines, margin + 2, y)
    let lineCount = nameLines.length

    // Variant line (indented)
    if (variantLine) {
      doc.setFontSize(8)
      doc.setTextColor(80, 80, 80)
      doc.text(doc.splitTextToSize(variantLine, nameW - 4), margin + 2, y + lineCount * 5)
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(10)
      lineCount++
    }

    // Right-aligned: qty × price + subtotal
    doc.text(qtyPriceLine, margin + nameW + qtyW, y, { align: 'right' })
    doc.text(subtotalLine, margin + contentW, y, { align: 'right' })

    y += lineCount * 5 + 2

    // Light divider
    doc.setDrawColor(240, 240, 240)
    doc.setLineWidth(0.2)
    doc.line(margin, y, pageW - margin, y)
    y += 3
  }

  y += 4

  // ----- Summary -----
  const summaryLines: Array<[string, string, boolean]> = [
    ['Subtotal', formatRupiah(order.subtotal), false],
  ]
  if (order.discount > 0) {
    const lbl = order.voucherCode ? `Diskon (${order.voucherCode})` : 'Diskon'
    summaryLines.push([lbl, `-${formatRupiah(order.discount)}`, false])
  }
  if (order.shipping && order.shipping > 0) {
    summaryLines.push(['Ongkir', formatRupiah(order.shipping), false])
  }
  summaryLines.push(['Total', formatRupiah(order.total), true])

  for (const [label, value, bold] of summaryLines) {
    if (bold) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setFillColor(245, 245, 245)
      doc.rect(margin, y - 4, contentW, 8, 'F')
      doc.text(label, margin + 2, y, { baseline: 'middle' })
      doc.setTextColor(220, 80, 40) // primary orange
      doc.text(value, margin + contentW, y, { align: 'right', baseline: 'middle' })
      doc.setTextColor(0, 0, 0)
      y += 10
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(label, margin + 2, y, { baseline: 'middle' })
      doc.text(value, margin + contentW, y, { align: 'right', baseline: 'middle' })
      y += 6
    }
  }

  // ----- Footer -----
  y = Math.max(y + 10, 250)
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10)
  doc.text('Terima kasih telah berbelanja di Anima Companion.', pageW / 2, y, { align: 'center' })
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(`${BRAND.legalName} — ${BRAND.address}`, pageW / 2, y, { align: 'center' })

  // Save with filename pattern: Anima-Receipt-AC-YYYYMMDD-NNN.pdf
  doc.save(`Anima-Receipt-${order.orderNumber}.pdf`)
}

/**
 * Helper: wrap long lines for the customer block (uses doc.splitTextToSize).
 */
function wrapLines(doc: jsPDF, lines: string[], maxWidth: number): string[] {
  const out: string[] = []
  for (const l of lines) {
    const wrapped = doc.splitTextToSize(l, maxWidth)
    out.push(...wrapped)
  }
  return out
}

/**
 * Open the browser's print dialog with a dedicated receipt layout.
 *
 * Strategy: open a new window, write a clean HTML receipt (no admin UI),
 * wait for assets to load, then trigger print. The new window closes
 * after the print dialog is dismissed (or remains open if the user
 * cancels — they can manually close it).
 *
 * This is preferred over an in-page @media print CSS approach because:
 *   1. Avoids affecting the admin layout's print styles.
 *   2. The receipt has its own clean styling (no admin sidebar/topbar).
 *   3. The user can pick "Save as PDF" from the print dialog if they
 *      want a PDF without using the jspdf path.
 */
export function printReceipt(order: ReceiptOrder) {
  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) {
    alert('Pop-up diblokir. Izinkan pop-up untuk situs ini lalu coba lagi.')
    return
  }

  const itemsHtml = order.items.map((item) => `
    <tr>
      <td class="name">
        <div class="product">${escapeHtml(item.productName)}</div>
        ${item.variantName ? `<div class="variant">Varian: ${escapeHtml(item.variantName)}</div>` : ''}
      </td>
      <td class="qty">${item.quantity} × ${formatRupiah(item.price)}</td>
      <td class="sub">${formatRupiah(item.subtotal)}</td>
    </tr>
  `).join('')

  const summaryRows = [
    `<tr><td>Subtotal</td><td>${formatRupiah(order.subtotal)}</td></tr>`,
    ...(order.discount > 0 ? [`<tr class="discount"><td>Diskon${order.voucherCode ? ` (${escapeHtml(order.voucherCode)})` : ''}</td><td>-${formatRupiah(order.discount)}</td></tr>`] : []),
    ...(order.shipping && order.shipping > 0 ? [`<tr><td>Ongkir</td><td>${formatRupiah(order.shipping)}</td></tr>`] : []),
    `<tr class="total"><td>Total</td><td>${formatRupiah(order.total)}</td></tr>`,
  ].join('')

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Struk ${escapeHtml(order.orderNumber)} — Anima Companion</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a1a;
      margin: 0;
      padding: 24px;
      font-size: 12px;
    }
    .header { text-align: center; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #ddd; }
    .brand { font-size: 22px; font-weight: 800; color: #c8341a; letter-spacing: -0.02em; }
    .tagline { font-size: 11px; color: #666; margin-top: 2px; }
    .address { font-size: 10px; color: #888; margin-top: 6px; line-height: 1.5; }
    .title { text-align: center; font-size: 16px; font-weight: 700; margin: 16px 0 12px; }
    .meta { background: #f7f7f7; padding: 10px 12px; border-radius: 6px; margin-bottom: 16px; font-size: 11px; }
    .meta-row { display: flex; justify-content: space-between; padding: 2px 0; }
    .meta-label { color: #666; }
    .meta-value { font-weight: 600; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin: 14px 0 6px; }
    .customer { background: #fafafa; padding: 10px 12px; border-radius: 6px; font-size: 11px; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th { background: #f0f0f0; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #666; text-align: left; }
    th:last-child, td.qty, td.sub { text-align: right; }
    td { padding: 8px; border-bottom: 1px solid #eee; vertical-align: top; font-size: 11px; }
    td.name .product { font-weight: 600; }
    td.name .variant { color: #c8341a; font-size: 10px; margin-top: 2px; }
    .summary { margin-top: 16px; }
    .summary table { border-collapse: collapse; }
    .summary td { padding: 4px 8px; border: none; font-size: 11px; }
    .summary tr.total td { font-size: 14px; font-weight: 800; color: #c8341a; padding-top: 8px; border-top: 2px solid #c8341a; }
    .footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; }
    .thank-you { font-style: italic; font-size: 12px; }
    .legal { font-size: 9px; color: #888; margin-top: 4px; }
    @media print {
      body { padding: 0; }
      .header { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">Anima Companion</div>
    <div class="tagline">Elevating Animal Health</div>
    <div class="address">
      ${escapeHtml(BRAND.address)}<br>
      ${escapeHtml(BRAND.email)} · ${escapeHtml(BRAND.whatsapp)}
    </div>
  </div>

  <div class="title">STRUK PESANAN</div>

  <div class="meta">
    <div class="meta-row"><span class="meta-label">No. Pesanan</span><span class="meta-value">${escapeHtml(order.orderNumber)}</span></div>
    <div class="meta-row"><span class="meta-label">Tanggal</span><span class="meta-value">${escapeHtml(formatDateTime(order.createdAt))}</span></div>
    <div class="meta-row"><span class="meta-label">Status</span><span class="meta-value">${escapeHtml(ORDER_STATUS[order.status]?.label || order.status)}</span></div>
  </div>

  <div class="section-title">Data Pelanggan</div>
  <div class="customer">
    <div><strong>Nama:</strong> ${escapeHtml(order.customerName)}</div>
    <div><strong>No HP:</strong> ${escapeHtml(order.customerPhone)}</div>
    ${order.customerEmail ? `<div><strong>Email:</strong> ${escapeHtml(order.customerEmail)}</div>` : ''}
    ${order.address ? `<div><strong>Alamat:</strong> ${escapeHtml(order.address)}</div>` : ''}
  </div>

  <div class="section-title">Item Pesanan</div>
  <table>
    <thead>
      <tr><th>Produk</th><th>Qty × Harga</th><th>Subtotal</th></tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="summary">
    <table>
      ${summaryRows}
    </table>
  </div>

  <div class="footer">
    <div class="thank-you">Terima kasih telah berbelanja di Anima Companion.</div>
    <div class="legal">${escapeHtml(BRAND.legalName)} — ${escapeHtml(BRAND.address)}</div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        // Close after print dialog closes (works in most browsers; users can manually close otherwise)
        window.onafterprint = function() { window.close(); };
      }, 200);
    };
  </script>
</body>
</html>`

  win.document.open()
  win.document.write(html)
  win.document.close()
}

/**
 * Escape HTML special characters in user-supplied strings (customer name,
 * address, product name, variant name, voucher code) to prevent XSS when
 * injecting into the receipt HTML.
 */
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Generate a CSV string from a list of orders, with one row per order-item
 * (order metadata is repeated on each item row).
 *
 * Columns:
 *   No Pesanan, Tanggal, Nama Pelanggan, No HP, Status,
 *   Produk, Varian, Qty, Harga Satuan, Subtotal, Total Pesanan
 *
 * Format:
 *   - UTF-8 with BOM (so Excel/Google Sheets detect encoding correctly
 *     and don't garble Indonesian characters).
 *   - All values are double-quoted. Inner double-quotes are escaped as "".
 *   - Phone and order numbers are formatted as text (preserved as-is inside
 *     quotes) so Excel doesn't strip leading zeros or interpret as number.
 *   - Dates are formatted in WIB (Asia/Jakarta) using formatDateTime.
 *   - Currency values are rendered as plain integers (no "Rp" prefix, no
 *     thousand separators) so Excel can interpret them as numbers if desired.
 *
 * Filename pattern: "pesanan-anima-{from}-{sampai}.csv" (or
 * "pesanan-anima-all.csv" if no date filter is applied).
 */
export function exportOrdersCsv(orders: ReceiptOrder[], from?: string, to?: string) {
  const headers = [
    'No Pesanan',
    'Tanggal',
    'Nama Pelanggan',
    'No HP',
    'Status',
    'Produk',
    'Varian',
    'Qty',
    'Harga Satuan',
    'Subtotal',
    'Total Pesanan',
  ]

  const rows: string[][] = []
  for (const o of orders) {
    const statusLabel = ORDER_STATUS[o.status]?.label || o.status
    for (const item of o.items) {
      rows.push([
        o.orderNumber,
        formatDateTime(o.createdAt),
        o.customerName,
        o.customerPhone,
        statusLabel,
        item.productName,
        item.variantName || '',
        String(item.quantity),
        String(item.price),
        String(item.subtotal),
        String(o.total),
      ])
    }
  }

  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n')

  // BOM so Excel detects UTF-8
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = from && to
    ? `pesanan-anima-${from}-sampai-${to}.csv`
    : 'pesanan-anima-all.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function csvCell(value: string): string {
  // Double-quote all cells. Inner double-quotes are escaped as "".
  // This guarantees Excel/Google Sheets parse the CSV correctly even if
  // values contain commas, newlines, or quotes.
  const s = String(value ?? '')
  return `"${s.replace(/"/g, '""')}"`
}
