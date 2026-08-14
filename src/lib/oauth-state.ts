/**
 * OAuth state cookie — browser-bound CSRF defense for the Google OAuth flow.
 *
 * WHY THIS EXISTS (Verified Identity V1 cleanup):
 *   The previous `createOAuthState` only issued an HMAC-signed self-contained
 *   state token (`{ next, nonce, exp }`) returned to Google as the `state`
 *   query param. HMAC signing prevents tampering, and the `nonce` prevents
 *   replay within the TTL — but the state token is NOT bound to the browser
 *   that initiated the flow. An attacker who obtains a valid (signed, fresh)
 *   state URL — e.g. via a phishing page that starts the OAuth flow on the
 *   victim's behalf, or a leaked referer header, or any cross-site navigation
 *   that exposes the callback URL — can replay it from a different browser
 *   within the 10-minute TTL and complete the OAuth login as themselves.
 *
 *   The fix per the task spec: bind OAuth initiation to the same browser
 *   using a cryptographically random, short-lived HttpOnly + SameSite cookie.
 *   The callback MUST require an exact state/nonce match AND consume/clear
 *   the cookie. After consumption the cookie is useless — replay is rejected.
 *
 * ARCHITECTURE:
 *   - `/api/auth/google` (entry) creates BOTH:
 *       (1) the signed state token returned to Google as `?state=...`
 *           (carries `next`, `nonce`, `exp` — same as before)
 *       (2) a sibling HttpOnly+SameSite cookie `anima_oauth_state` whose
 *           value is the SAME nonce as embedded in the state token.
 *     The cookie is set on the response that 302-redirects to Google. The
 *     nonce is 32 bytes of CSPRNG, hex-encoded.
 *   - `/api/auth/google/callback` receives `?state=...` from Google AND
 *     the `anima_oauth_state` cookie from the browser. It:
 *       (1) verifies the HMAC signature + expiry of `state` (unchanged),
 *       (2) reads the nonce from the cookie,
 *       (3) requires `cookieNonce === statePayload.nonce` — exact match.
 *           Any mismatch (missing cookie, different nonce, replay attempt)
 *           → reject as `invalid_state`.
 *       (4) clears the cookie (consume) before issuing the session cookie.
 *
 * SECURITY CONTRACT:
 *   - Cookie is HttpOnly → not readable by client-side JS.
 *   - Cookie is SameSite=Lax → not sent on cross-site requests (the OAuth
 *     callback IS a same-site top-level navigation from Google, so Lax
 *     is correct; Strict would block the callback).
 *   - Cookie is Secure in production (HTTPS only).
 *   - Cookie has the same 10-minute TTL as the state token — expires
 *     alongside it.
 *   - Cookie is single-use: consumed (overwritten with empty + immediate
 *     expiry) at the end of the callback, BEFORE the session cookie is set.
 *     So a replayed callback URL hitting the route again will see no
 *     matching cookie and be rejected.
 *   - The cookie value is the nonce, NOT the entire signed state. The
 *     signed state is what Google echoes back as `?state=`; the cookie
 *     is our separate browser-binding channel.
 *
 * This helper does NOT replace `createOAuthState` / `verifyOAuthState` —
 * those continue to handle the signed state token. This helper layers the
 * browser-binding on top.
 */

import { cookies } from 'next/headers'
import { randomBytes, timingSafeEqual } from 'crypto'

export const OAUTH_STATE_COOKIE = 'anima_oauth_state'
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes — same TTL as the signed state token

/**
 * Generate a fresh 32-byte CSPRNG nonce, hex-encoded (64 chars).
 * This nonce is stored BOTH in the signed state token (as `nonce`) AND
 * in the sibling browser cookie. The callback requires exact match.
 */
export function generateOAuthNonce(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Set the OAuth state cookie on the current response. Called by
 * `/api/auth/google` after `createOAuthState`. The cookie value is
 * the nonce — the SAME nonce that was embedded in the signed state
 * token when `createOAuthState` was called.
 *
 * The cookie is HttpOnly + SameSite=Lax + Secure-in-prod + 10-min TTL.
 * It is single-use: `consumeOAuthStateCookie()` clears it at the end of
 * the callback.
 */
export async function setOAuthStateCookie(nonce: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: Math.floor(OAUTH_STATE_TTL_MS / 1000),
    path: '/',
  })
}

/**
 * Verify the OAuth state cookie against the nonce in the signed state
 * token. Called by `/api/auth/google/callback`.
 *
 * Returns `true` if:
 *   - the cookie is present, AND
 *   - the cookie value exactly equals `stateNonce`.
 * Returns `false` otherwise (missing cookie, mismatched nonce, etc.).
 *
 * This is the EXACT-MATCH requirement: any drift between the browser that
 * initiated the flow (the cookie) and the state token returned by Google
 * is treated as a CSRF/replay attempt and rejected.
 *
 * The cookie is NOT consumed inside this function — the caller must call
 * `consumeOAuthStateCookie()` only AFTER deciding the rest of the flow
 * (code exchange + ID-token verification) is going to succeed, so a
 * mid-flow error doesn't burn the cookie and force the user to re-consent.
 */
export async function verifyOAuthStateCookie(stateNonce: string): Promise<boolean> {
  if (!stateNonce) return false
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(OAUTH_STATE_COOKIE)?.value
  if (!cookieValue) return false
  // Exact-match constant-time comparison. We use `timingSafeEqual` to
  // avoid leaking the nonce length / prefix via timing differences. Both
  // values are 64-char hex strings of equal length when valid, so the
  // length-mismatch branch is only reached on a malformed input.
  if (cookieValue.length !== stateNonce.length) return false
  try {
    const a = Buffer.from(cookieValue, 'utf8')
    const b = Buffer.from(stateNonce, 'utf8')
    if (a.length !== b.length) return false
    return cryptoEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Consume (clear) the OAuth state cookie. Called at the end of a successful
 * OAuth callback, just before issuing the session cookie. After this, the
 * same `?state=...` URL cannot be replayed — the cookie is gone, so
 * `verifyOAuthStateCookie` will return false on the next request.
 *
 * Safe to call multiple times (idempotent). If the cookie was never set,
 * this is a no-op.
 */
export async function consumeOAuthStateCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // expire immediately
    path: '/',
  })
}

// Constant-time equality using Node's `timingSafeEqual`. The function is
// sync (no await needed) and refuses to short-circuit on the first
// mismatched byte — every byte is XOR'd and the result OR'd together.
function cryptoEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false
  // timingSafeEqual throws if lengths differ (already guarded above) or
  // if either buffer is empty. We catch+false rather than throw, because
  // throwing would be observably different from a mismatch (timing channel).
  try {
    return timingSafeEqual(a, b)
  } catch {
    // Manual fallback — same length, XOR each byte.
    let diff = 0
    for (let i = 0; i < a.length; i++) {
      diff |= a[i] ^ b[i]
    }
    return diff === 0
  }
}
