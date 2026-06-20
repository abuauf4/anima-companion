'use client'

import { useEffect, useState, useCallback } from 'react'

export interface Route {
  path: string           // e.g., "/", "/shop", "/product/immuno-plus", "/admin/products"
  segments: string[]     // e.g., ["product", "immuno-plus"]
  query: URLSearchParams
}

function parseHash(): Route {
  const raw = window.location.hash.slice(1) || '/'
  const [pathPart, queryPart] = raw.split('?')
  const path = pathPart || '/'
  const segments = path.split('/').filter(Boolean)
  const query = new URLSearchParams(queryPart || '')
  return { path, segments, query }
}

export function useHashRouter() {
  const [route, setRoute] = useState<Route>(() =>
    typeof window !== 'undefined' ? parseHash() : { path: '/', segments: [], query: new URLSearchParams() }
  )

  useEffect(() => {
    const handler = () => setRoute(parseHash())
    window.addEventListener('hashchange', handler)
    // Initialize hash to '/' if empty
    if (!window.location.hash) {
      window.location.hash = '/'
    }
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const navigate = useCallback((path: string) => {
    if (path.startsWith('#')) path = path.slice(1)
    window.location.hash = path
    // Scroll to top on navigation
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  return { route, navigate }
}

/** Helper to build a href for hash-based navigation */
export function href(path: string): string {
  return `#${path.startsWith('/') ? path : '/' + path}`
}
