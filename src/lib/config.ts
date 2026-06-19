/** Site-wide configuration */
export const SITE_CONFIG = {
  name: 'Anima Companion',
  tagline: 'Healthy Pets, Happy Companions',
  description: 'Vitamin, suplemen, dan kebutuhan kesehatan hewan peliharaan.',
  whatsappNumber: '6281234567890', // Admin WhatsApp (placeholder — change in production)
  email: 'hello@animacompanion.id',
  instagram: '@animacompanion',
  tiktok: '@animacompanion',
  address: 'Jakarta Selatan, Indonesia',
  hours: 'Senin–Sabtu, 09.00–18.00 WIB',
  freeShippingThreshold: 150000,
}

export function whatsappAdminUrl(message?: string): string {
  const base = `https://wa.me/${SITE_CONFIG.whatsappNumber}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}
