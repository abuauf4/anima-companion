/** Site-wide configuration — Anima Companion (PT Sutan Vet Medika) */
export const SITE_CONFIG = {
  name: 'Anima Companion',
  tagline: 'Elevating Animal Health',
  description: 'Suplemen & vitamin hewan peliharaan premium. Produk Anima Companion — PT Sutan Vet Medika.',
  // Official WhatsApp number (PT Sutan Vet Medika / Anima Companion).
  // Stored in E.164-without-`+` form for wa.me links: 6282210846408.
  // Display form (local prefix, grouped 4-4-4): "0822 1084 6408".
  // tel: form: "+6282210846408".
  whatsappNumber: '6282210846408',
  email: 'sutanvetmedika@gmail.com',
  // Verified real social channels
  instagram: '@anima.companion',
  instagramUrl: 'https://instagram.com/anima.companion',
  shopeeUrl: 'https://shopee.co.id/anima.companion',
  tiktok: '@anima.companion',
  // TODO: verify TikTok Shop URL with PT Sutan Vet Medika
  // Real company location — PT Sutan Vet Medika is based at Gedung STP - IPB,
  // Bogor, Jawa Barat.
  address: 'Gedung STP - IPB lt 1, Bogor, Jawa Barat',
  hours: 'Senin–Sabtu, 09.00–18.00 WIB',
  freeShippingThreshold: 150000,
  // Distribution: available in 400+ veterinary clinics across Indonesia
  clinicCount: '400+',
}

/**
 * WhatsApp admin chat URL (wa.me format).
 * Uses the official WhatsApp number from SITE_CONFIG.
 * @param message optional prefilled message
 */
export function whatsappAdminUrl(message?: string): string {
  const base = `https://wa.me/${SITE_CONFIG.whatsappNumber}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

/**
 * Display form of the official WhatsApp number, e.g. "0822 1084 6408".
 * Accepts either 62... or 0... form. Grouped 4-4-4 with leading 0 (local).
 *
 * Example: "6282210846408" → "0822 1084 6408"
 */
export function whatsappDisplayNumber(raw: string = SITE_CONFIG.whatsappNumber): string {
  let digits = raw.replace(/\D/g, '')
  // Normalize to local form with leading 0
  if (digits.startsWith('62')) digits = '0' + digits.slice(2)
  else if (!digits.startsWith('0')) digits = '0' + digits
  // Group as 4-4-4 starting from the leading 0: "0822 1084 6408"
  const g1 = digits.slice(0, 4)
  const g2 = digits.slice(4, 8)
  const g3 = digits.slice(8, 12)
  return [g1, g2, g3].filter(Boolean).join(' ')
}

/**
 * tel: link form of the official WhatsApp number, e.g. "tel:+6282210846408".
 * Accepts either 62... or 0... form.
 */
export function whatsappTelUrl(raw: string = SITE_CONFIG.whatsappNumber): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = '62' + digits.slice(1)
  else if (!digits.startsWith('62')) digits = '62' + digits
  return `tel:+${digits}`
}
