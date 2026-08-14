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
 *   6. ENCODED-BYPASS DEFENSE: if the input contains any `%` character, we
 *      also `decodeURIComponent` it and re-check rules 3 and 4 against the
 *      decoded form. This catches inputs like `/%2F%2Fevil.example.com` or
 *      `/%5Cevil.example.com` which, if a downstream consumer decodes them
 *      before navigating, would resolve to `///evil.example.com` or
 *      `/\evil.example.com` and become scheme-relative open redirects.
 *      Malformed sequences (`%ZZ`, `%2`, lone `%`) are rejected outright.
 *      NOTE: `URLSearchParams.get()` already decodes once, so in normal
 *      LoginView/RegisterView usage the input arrives already-decoded and
 *      this check is a defense-in-depth net for callers that pass raw
 *      (still-encoded) strings.
 *   7. CONTROL-CHAR DEFENSE: inputs containing ASCII control characters
 *      (0x00–0x1F or 0x7F) are rejected. These are not valid in URL paths
 *      and can be used to confuse log readers or to sneak characters past
 *      naive string-equality checks in downstream consumers. Whitespace
 *      chars \t, \n, \r are included in this range.
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

  // ENCODED-BYPASS DEFENSE: if the input still contains percent-encoded
  // sequences, decode it and re-check the scheme-relative prefix rules.
  // This is defense-in-depth: the canonical caller (URLSearchParams.get)
  // already decodes once, but if someone later calls this helper on a raw
  // query string (e.g. `req.url.split('?')[1]`), we still want to be safe.
  // Malformed sequences (e.g. `%ZZ`, `%2`, lone `%`) cause decodeURIComponent
  // to throw — we treat that as a reject.
  if (raw.includes('%')) {
    let decoded: string
    try {
      decoded = decodeURIComponent(raw)
    } catch {
      return null
    }
    if (decoded.startsWith('//') || decoded.startsWith('/\\')) return null
  }

  // CONTROL-CHAR DEFENSE: reject ASCII control chars (0x00–0x1F, 0x7F).
  // This includes \t, \n, \r — they are not valid in URL paths and can
  // be used to confuse log readers or downstream consumers.
  if (/[\x00-\x1f\x7f]/.test(raw)) return null

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
