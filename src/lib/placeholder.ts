/**
 * Local SVG Placeholder Image Generator
 *
 * Why: placehold.co returns SVG but is often slow / unreliable.
 * This generates a self-contained data URL with brand colors + product name,
 * so images always render instantly without external network calls.
 */

const PRODUCT_COLORS: Record<string, string> = {
  // Zesty Paws products
  'zesty-paws-probiotic-bites-dogs': 'F97316',
  'zesty-paws-8-in-1-multivitamin-dogs': '7C3AED',
  'zesty-paws-hip-and-joint-advanced': 'F59E0B',
  'zesty-paws-calming-bites-cats': 'EC4899',
  'zesty-paws-skin-and-coat-omega': '06B6D4',
  'zesty-paws-allergy-immune-dogs': '3B82F6',
  'zesty-paws-urinary-tract-cats': '8B5CF6',
  // Native Pet
  'native-pet-probiotic-powder-dogs': '22C55E',
  'native-pet-omega-3-salmon-oil': 'F43F5E',
  // Vetri Science
  'vetri-science-glycoflex-hip-joint': '0EA5E9',
  'vetri-science-immune-cats': '14B8A6',
  // Pet Honesty
  'pet-honesty-allergy-support-dogs': 'EF4444',
  'pet-honesty-multivitamin-10-in-1': 'DC2626',
  // Anima Companion
  'anima-companion-immuno-plus': '3B82F6',
  'anima-companion-appetite-booster': 'EF4444',
}

const FALLBACK_COLORS = [
  'F97316', '7C3AED', '22C55E', 'EC4899', 'F59E0B',
  '06B6D4', '3B82F6', 'F43F5E', '0EA5E9', '8B5CF6',
]

/**
 * Generate an SVG placeholder as data URL.
 * Card-style: solid color background, brand name + product name + emoji icon.
 */
export function generatePlaceholderDataUrl(
  productName: string,
  slug: string,
  brandName?: string,
  size = 600,
): string {
  const color = PRODUCT_COLORS[slug] || FALLBACK_COLORS[slug.length % FALLBACK_COLORS.length]

  // Escape XML special chars
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  // Pick emoji based on pet type (slug heuristic)
  const emoji = slug.includes('cat') ? '🐱' : slug.includes('dog') ? '🐶' : '🐾'

  // Split product name into 2 lines if too long
  const words = productName.split(' ')
  const mid = Math.ceil(words.length / 2)
  const line1 = esc(words.slice(0, mid).join(' '))
  const line2 = esc(words.slice(mid).join(' '))

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#${color}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#${color}" stop-opacity="0.75"/>
    </linearGradient>
    <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="1.5" fill="rgba(255,255,255,0.18)"/>
    </pattern>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" fill="url(#dots)"/>
  <text x="50%" y="42%" text-anchor="middle" dominant-baseline="middle" font-size="120" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${emoji}</text>
  <text x="50%" y="66%" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="700" fill="white">${line1}</text>
  ${line2 ? `<text x="50%" y="74%" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="700" fill="white">${line2}</text>` : ''}
  ${brandName ? `<text x="50%" y="86%" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="500" fill="rgba(255,255,255,0.85)">by ${esc(brandName)}</text>` : ''}
  <text x="50%" y="95%" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" fill="rgba(255,255,255,0.6)" letter-spacing="2">ANIMA COMPANION</text>
</svg>`

  // Encode SVG to data URL (URL-encoded for safety in <img src>)
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22')
  return `data:image/svg+xml;charset=utf-8,${encoded}`
}

/**
 * Check if a URL is a placehold.co URL that should be replaced.
 */
export function isPlaceholdCo(url: string): boolean {
  return url?.includes('placehold.co') || false
}
