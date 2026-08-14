/**
 * Open-redirect defense for `?next=...` query parameters.
 *
 * SECURITY CONTRACT:
 *   - Returns the path as-is if it is a SAFE internal application path.
 *   - Returns `null` if the input is missing, external, scheme-relative,
 *     contains a backslash (which browsers may normalize to forward slash),
 *     or looks like a `javascript:` / `data:` URL.
 *
 * WHAT "SAFE INTERNAL" MEANS:
 *   1. Must be a string with length > 0.
 *   2. Must start with a single `/` (so relative URLs without a leading
 *      slash — e.g. `evil.com/x` — are rejected).
 *   3. Must NOT start with `//` (scheme-relative URL — browser treats
 *      `//evil.example.com` as `https://evil.example.com` on an HTTPS page).
 *   4. Must NOT start with `/\` (browsers normalize backslash to slash,
 *      so `/\evil.example.com` becomes `//evil.example.com`).
 *   5. Must NOT contain a `:` BEFORE the first `/` after the leading slash
 *      (i.e., no `javascript:`, `data:`, `http:`, `https:` etc. as a prefix).
 *
 * The check is intentionally conservative: anything that doesn't look like
 * a normal internal path (e.g. `/checkout`, `/admin/orders`, `/`) returns
 * `null`, and the caller falls back to the default post-auth destination.
 *
 * USAGE:
 *   import { safeInternalPath } from '@/lib/redirect'
 *   const next = safeInternalPath(route.query.get('next'))
 *   if (next) navigate(next)
 *   else navigate('/')
 *
 * This helper is shared by LoginView and RegisterView so both flows apply
 * the same open-redirect defense. Do NOT inline this logic in the views —
 * any divergence between login and register would create a hole.
 */
export function safeInternalPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (raw.length === 0) return null
  if (!raw.startsWith('/')) return null
  // Scheme-relative URL: `//evil` or `/\evil` (browser normalizes backslash).
  if (raw.startsWith('//')) return null
  if (raw.startsWith('/\\')) return null
  // Reject anything that looks like a scheme prefix (`javascript:`, `data:`,
  // `http://`, `https://`). For internal paths, the first `/` is at index 0,
  // so any `:` appearing before the NEXT `/` indicates a scheme. We scan the
  // remainder of the path for a `:` that isn't part of a normal URL fragment
  // (query param values can contain `:` — but only AFTER `?`, which we
  // also detect).
  const rest = raw.slice(1) // strip the leading `/`
  const questionIdx = rest.indexOf('?')
  const hashIdx = rest.indexOf('#')
  // Path-segment end is the earliest of `?`, `#`, or end-of-string.
  let pathEnd = rest.length
  if (questionIdx >= 0 && questionIdx < pathEnd) pathEnd = questionIdx
  if (hashIdx >= 0 && hashIdx < pathEnd) pathEnd = hashIdx
  const pathSegment = rest.slice(0, pathEnd)
  if (pathSegment.includes(':')) return null
  return raw
}
