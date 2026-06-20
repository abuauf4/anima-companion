'use client'

import { useEffect, useState } from 'react'
import { Banner, Product, Problem, Testimonial, PetType } from '@/hooks/use-fetch'

export interface HomeData {
  banners: Banner[]
  bestSellers: Product[]
  newProducts: Product[]
  problems: Problem[]
  testimonials: Testimonial[]
  petTypes: PetType[]
  saleCountdown?: { endsAt: string }
}

const STORAGE_KEY = 'anima-home-cache-v1'
const STORAGE_TTL = 5 * 60 * 1000 // 5 minutes — accept stale up to 5 min

interface StoredCache {
  data: HomeData
  timestamp: number
}

/**
 * Read cached home data from sessionStorage (instant render on revisit).
 * Returns null if no cache or expired beyond TTL.
 */
function readCache(): HomeData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredCache
    const age = Date.now() - parsed.timestamp
    if (age > STORAGE_TTL) {
      // Too stale — return null so caller knows to fetch fresh
      // (But we'll still render this stale data while fetching fresh)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

/**
 * Read even stale cache (any age) for instant render.
 * Use this for stale-while-revalidate pattern.
 */
function readStaleCache(): HomeData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredCache
    return parsed.data
  } catch {
    return null
  }
}

function writeCache(data: HomeData) {
  if (typeof window === 'undefined') return
  try {
    const stored: StoredCache = { data, timestamp: Date.now() }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // sessionStorage might be full (rare) — ignore silently
  }
}

/**
 * Hook: fetch /api/home with stale-while-revalidate pattern.
 *
 * Flow:
 * 1. On mount, immediately read from sessionStorage (if exists) → render instant
 * 2. In background, fetch fresh /api/home
 * 3. When fresh data arrives, update state + write to sessionStorage
 * 4. If fresh fetch fails, keep stale data (don't show empty)
 *
 * Result:
 * - First visit: loading=true → skeleton shown → fresh data arrives (~8s cold start)
 * - Repeat visit: stale data shown INSTANTLY (0ms) → fresh data refreshes in background
 *
 * isStale flag indicates we're showing cached (potentially outdated) data.
 * isLoading flag indicates we have no data yet (truly first visit).
 */
export function useHomeData() {
  const [data, setData] = useState<HomeData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isStale, setIsStale] = useState(false)

  useEffect(() => {
    // Step 1: Read stale cache immediately (synchronous, instant render)
    const stale = readStaleCache()
    if (stale) {
      setData(stale)
      setIsStale(true)
      setIsLoading(false)
    }

    // Step 2: Fetch fresh data in background
    let cancelled = false
    fetch('/api/home', { cache: 'default' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((fresh: HomeData) => {
        if (cancelled) return
        setData(fresh)
        setIsStale(false)
        setIsLoading(false)
        writeCache(fresh)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[useHomeData] fetch failed, using stale cache if available:', err)
        // If we have stale data, keep showing it (don't show empty)
        // If no stale data, isLoading stays true → caller shows skeleton
        if (stale) {
          setIsStale(true)
          setIsLoading(false)
        } else {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return {
    data,
    isLoading,
    isStale,
    // Convenience getters with empty-array fallbacks
    banners: data?.banners || [],
    bestSellers: data?.bestSellers || [],
    newProducts: data?.newProducts || [],
    problems: data?.problems || [],
    testimonials: data?.testimonials || [],
    petTypes: data?.petTypes || [],
    saleCountdown: data?.saleCountdown,
  }
}
