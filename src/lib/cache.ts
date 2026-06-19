/**
 * Simple in-memory cache with TTL + retry on transient errors.
 *
 * Why this exists:
 * - Supabase pooler (Tokyo region) adds ~200-1000ms per query from sandbox.
 * - Homepage fires 5 parallel API calls, each hitting Supabase.
 * - Caching responses for 60s reduces repeat load from ~1s to <5ms.
 * - Supabase free tier pool=15, can exhaust under concurrent load → retry.
 *
 * Cache is per-server-instance (in-memory). For multi-instance deploys,
 * upgrade to Redis or Vercel KV later — the API stays the same.
 */

type Entry<T> = {
  value: T
  expiresAt: number
}

const store = new Map<string, Entry<unknown>>()

// Periodically purge expired entries (every 5 min) to avoid memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [k, v] of store.entries()) {
      if (v.expiresAt < now) store.delete(k)
    }
  }, 5 * 60 * 1000).unref?.()
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Check if error is a transient Supabase/Prisma connection error worth retrying */
function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('EMAXCONNSESSION') ||
    msg.includes('pool_size') ||
    msg.includes('Timed out fetching') ||
    msg.includes('Can\'t reach database server') ||
    msg.includes('P1001') ||
    msg.includes('Connection terminated') ||
    msg.includes('Connection refused')
  )
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  options: { retries?: number; retryDelayMs?: number } = {}
): Promise<T> {
  const { retries = 2, retryDelayMs = 300 } = options

  // Check cache first
  const hit = store.get(key) as Entry<T> | undefined
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value
  }

  // Try fetcher with retry on transient errors
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const value = await fetcher()
      store.set(key, { value, expiresAt: Date.now() + ttlMs })
      return value
    } catch (err) {
      lastErr = err
      if (attempt < retries && isTransientError(err)) {
        // Exponential backoff: 300ms, 600ms
        await sleep(retryDelayMs * (attempt + 1))
        continue
      }
      break
    }
  }

  // All retries failed — but if we have stale cache, serve it (better than error)
  const stale = store.get(key) as Entry<T> | undefined
  if (stale) {
    return stale.value
  }

  throw lastErr
}

export function invalidate(prefix: string) {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k)
  }
}
