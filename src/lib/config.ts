/** Site-wide configuration — Anima Companion (PT Sutan Vet Medika) */
export const SITE_CONFIG = {
  name: 'Anima Companion',
  tagline: 'Elevating Animal Health',
  description: 'Suplemen & vitamin hewan peliharaan rekomendasi dokter hewan. Produk Anima Companion — PT Sutan Vet Medika.',
  // Admin WhatsApp (placeholder — TODO: replace with official Anima Companion WA number)
  whatsappNumber: '6281234567890',
  email: 'hello@animacompanion.id',
  // Verified real social channels
  instagram: '@anima.companion',
  instagramUrl: 'https://instagram.com/anima.companion',
  shopeeUrl: 'https://shopee.co.id/anima.companion',
  tiktok: '@anima.companion',
  // TODO: verify TikTok Shop URL with PT Sutan Vet Medika
  // Real company location — PT Sutan Vet Medika is based in Bogor
  address: 'Bogor, Jawa Barat, Indonesia',
  hours: 'Senin–Sabtu, 09.00–18.00 WIB',
  freeShippingThreshold: 150000,
  // Distribution: available in 515+ veterinary clinics across Indonesia
  clinicCount: '515+',
}

export function whatsappAdminUrl(message?: string): string {
  const base = `https://wa.me/${SITE_CONFIG.whatsappNumber}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}
