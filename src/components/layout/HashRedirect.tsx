'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * HashRedirect — backwards-compat for old hash-router URLs.
 *
 * Before Phase 1, the site used a custom hash router (`/#/shop`, `/#/product/...`).
 * Anyone with a bookmarked hash URL would land on `/` (since the hash isn't sent
 * to the server) and see the home page instead of their intended destination.
 *
 * This component, mounted once in the root layout, checks `window.location.hash`
 * on mount. If a `#/...` hash is present, it replaces the URL with the
 * equivalent real path — mapping `/shop` → `/produk` and `/product/` → `/produk/`
 * to match the new canonical URLs.
 *
 * Runs only once, immediately, before the page paints.
 */
const HASH_PATH_MAP: Record<string, string> = {
  // Old hash path → new real path
  // (Only /shop and /product/ are renamed; others stay the same.)
}

export function HashRedirect() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash || !hash.startsWith('#/')) return

    // Parse the path out of `#/...`
    let path = hash.slice(1) // strip leading '#'
    if (!path.startsWith('/')) path = '/' + path

    // Map old → new canonical paths
    if (path === '/shop' || path.startsWith('/shop?') || path.startsWith('/shop/')) {
      path = '/produk' + path.slice('/shop'.length)
    } else if (path.startsWith('/product/')) {
      path = '/produk/' + path.slice('/product/'.length)
    }

    // Strip the hash and replace the URL using the new path
    // Use `window.history.replaceState` so we don't trigger a re-render loop,
    // then push the path through Next.js router so client components hydrate.
    const newUrl =
      window.location.pathname +
      (path.includes('?') ? path.slice(path.indexOf('?')) : '') +
      window.location.search.replace(window.location.search, '')
    // Compose final URL: keep current pathname/search but drop the hash, then push the new path
    // Simpler: just push the mapped path through Next.js router.
    router.replace(path)
    // Clean: also clear the hash from the address bar (replaceState doesn't trigger Next router)
    window.history.replaceState(
      null,
      '',
      newUrl !== window.location.href ? window.location.pathname + window.location.search : window.location.href
    )
  }, [router])

  return null
}
