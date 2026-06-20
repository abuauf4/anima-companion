'use client'

import { useEffect, useRef, useState } from 'react'

export interface SearchSuggestion {
  id: string
  name: string
  slug: string
  brand: string
  price: number
  salePrice?: number | null
  image?: string
  category?: string
}

interface UseSearchOptions {
  /** Minimum characters before triggering search (default: 1) */
  minChars?: number
  /** Debounce delay in ms (default: 250) */
  debounceMs?: number
  /** Max results to return (default: 5) */
  limit?: number
}

/**
 * Debounced search hook with product autocomplete.
 *
 * - Triggers fetch /api/products?search=... after user types (debounced)
 * - Returns suggestions array + loading state
 * - Aborts in-flight requests when user types again
 * - Skips fetch when query is below minChars
 *
 * Usage:
 *   const { suggestions, loading } = useSearch(query)
 */
export function useSearch(
  query: string,
  options: UseSearchOptions = {}
) {
  const { minChars = 1, debounceMs = 250, limit = 5 } = options
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Trim + skip if too short
    const q = query.trim()
    if (q.length < minChars) {
      setSuggestions([])
      setLoading(false)
      // Cancel any pending request
      abortRef.current?.abort()
      return
    }

    setLoading(true)

    // Debounce timer
    const timer = setTimeout(async () => {
      // Abort previous in-flight request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch(
          `/api/products?search=${encodeURIComponent(q)}&limit=${limit}&sort=popular`,
          { signal: controller.signal }
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const products = (data.products || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          brand: p.brand,
          price: p.price,
          salePrice: p.salePrice,
          image: p.images?.[0]?.url || '',
          category: p.category?.name,
        })) as SearchSuggestion[]
        setSuggestions(products)
      } catch (err) {
        // AbortError is expected when user types again — ignore
        if (err instanceof Error && err.name === 'AbortError') return
        console.error('[useSearch] fetch failed:', err)
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, debounceMs)

    return () => {
      clearTimeout(timer)
    }
  }, [query, minChars, debounceMs, limit])

  return { suggestions, loading }
}
