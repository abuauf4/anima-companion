/**
 * Standard Cache-Control headers for public read-only API endpoints.
 *
 * Strategy:
 * - s-maxage=300: CDN caches response for 5 minutes
 * - stale-while-revalidate=600: After 5 min, serve stale + revalidate in background (up to 10 min)
 *
 * Result: After first cold load, repeat visitors get instant (<50ms) responses
 * from Vercel's edge cache. Cold start only hits the first visitor after expiry.
 *
 * Usage:
 *   import { CACHE_HEADERS } from '@/lib/cache-headers'
 *   return NextResponse.json(data, { headers: CACHE_HEADERS })
 *
 * NOTE: Do NOT use for authenticated endpoints (cart, orders, profile) —
 * those responses are user-specific and must not be shared via CDN cache.
 */
export const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
} as const

/**
 * Shorter cache for endpoints that change more often (e.g. product list with filters).
 * 1 min cache + 5 min stale-while-revalidate.
 */
export const CACHE_HEADERS_SHORT = {
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
} as const
