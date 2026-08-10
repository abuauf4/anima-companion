'use client'

/**
 * useHashRouter — backwards-compatible client-side router hook.
 *
 * Originally backed by `window.location.hash` (true hash router).
 * In Phase 1 (SEO migration) it now wraps Next.js App Router:
 *   - `route.path`     → from `usePathname()` (reactive)
 *   - `route.segments` → derived from path
 *   - `route.query`    → parsed from `window.location.search`, kept in sync
 *                        via the `navigate()` call and `popstate` listener
 *   - `navigate(p)`    → calls `router.push(p)` from `next/navigation`
 *
 * The hook keeps the same surface (`route`, `navigate`) so the dozens of
 * existing Navbar/Footer/MobileBottomBar/View call-sites don't need rewriting.
 *
 * `href()` previously returned a `#/path` string; it now returns the real
 * path (no hash), so any client `<a href={href('/produk')}>` still works.
 */

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export interface Route {
  /** Full path, e.g. "/", "/produk", "/produk/immuno-plus" */
  path: string
  /** Path split by `/` with empty segments removed, e.g. ["produk", "immuno-plus"] */
  segments: string[]
  /** Parsed query params. Reactive across same-path navigations. */
  query: URLSearchParams
}

function parseQuery(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams()
  return new URLSearchParams(window.location.search)
}

function buildRoute(pathname: string | null): Route {
  const path = pathname || '/'
  const segments = path.split('/').filter(Boolean)
  return {
    path,
    segments,
    query: parseQuery(),
  }
}

export function useHashRouter() {
  const pathname = usePathname()
  const router = useRouter()
  const [route, setRoute] = useState<Route>(() => buildRoute(pathname))

  // Re-build the route whenever the pathname changes (different page).
  useEffect(() => {
    setRoute(buildRoute(pathname))
  }, [pathname])

  // Listen for back/forward navigation (browser history) so the query
  // state stays in sync when the user uses the browser's back button.
  useEffect(() => {
    const handler = () => setRoute(buildRoute(pathname))
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [pathname])

  const navigate = useCallback(
    (path: string) => {
      // Backwards-compat: strip leading '#' if a caller passed an old-style
      // hash path (e.g. navigate('#/shop')). All current call-sites pass
      // real paths, but this keeps the API forgiving.
      if (path.startsWith('#')) path = path.slice(1)

      router.push(path)

      // Synchronously update local route state so consumers (e.g. Navbar's
      // search-input sync) see the new path/query immediately without
      // waiting for the next render cycle.
      const [pathPart, queryPart] = path.split('?')
      const newPath = pathPart || '/'
      const newQuery = new URLSearchParams(queryPart || '')
      setRoute({
        path: newPath,
        segments: newPath.split('/').filter(Boolean),
        query: newQuery,
      })

      // Scroll to top on navigation (matches previous hash-router behavior).
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      }
    },
    [router]
  )

  return { route, navigate }
}

/**
 * Helper to build an href for real Next.js routing.
 * Returns the path as-is (with leading slash if missing).
 * Previously returned `#/path` for hash routing — now returns `/path`.
 */
export function href(path: string): string {
  return path.startsWith('/') ? path : '/' + path
}
