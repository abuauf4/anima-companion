/**
 * Google Sign-In (Verified Identity V1) — manual OAuth 2.0 Authorization
 * Code flow with ID token verification.
 *
 * WHY NOT NEXT-AUTH:
 *   `next-auth@4.24.13` is in `package.json` (it was a scaffold dep)
 *   but it is NOT used anywhere in `src/`. Adopting it for Verified
 *   Identity V1 would mean:
 *     - replacing the existing custom HMAC session cookie (`anima_session`)
 *       with NextAuth's session cookie,
 *     - migrating every `requireAuth / requireAdmin / getCurrentUser`
 *       call site (used by /api/orders, /api/pet-profiles, /api/admin/**,
 *       etc.) to NextAuth's `getServerSession`,
 *     - re-implementing the demo-credential gating that depends on
 *       `process.env.NODE_ENV` checks at the route level.
 *   Per the task spec: "Jangan redesign auth system. Jangan ganti
 *   library/framework auth kecuali ditemukan vulnerability yang memang
 *   tidak bisa diperbaiki dengan arsitektur sekarang." The current
 *   architecture has no such vulnerability, so we stay on the custom
 *   HMAC session and layer Google on top.
 *
 * ARCHITECTURE:
 *   - `GET /api/auth/google`           — entry point. Generates a state
 *                                        token, redirects to Google consent.
 *   - `GET /api/auth/google/callback`  — Google redirects here with
 *                                        `?code=...&state=...`. Server
 *                                        exchanges code for tokens, verifies
 *                                        the `id_token` via `jose` using
 *                                        Google's published JWKS, then either
 *                                        creates a new GOOGLE user or signs
 *                                        into an existing one.
 *   - On success, the callback issues the SAME `anima_session` HMAC cookie
 *     used by the password flow. No session-layer change.
 *
 * ENV REQUIREMENTS (only when GOOGLE_OAUTH_ENABLED=1):
 *   GOOGLE_OAUTH_CLIENT_ID      — OAuth 2.0 Client ID from Google Cloud Console
 *   GOOGLE_OAUTH_CLIENT_SECRET  — OAuth 2.0 Client Secret (server-only)
 *   NEXT_PUBLIC_SITE_URL        — canonical app origin (already used for SEO)
 *
 * If these env vars are NOT set, the Google sign-in button on the login
 * page is hidden and `/api/auth/google` returns 503 with a clear config
 * message. This is the "implement as much as can be done correctly without
 * fake behavior" path — we don't fake Google login when it's unconfigured.
 */

import { createRemoteJWKSet, jwtVerify } from 'jose'

const GOOGLE_DISCOVERY_URL = 'https://accounts.google.com/.well-known/openid-configuration'

// Cache Google's JWKS — jose's createRemoteJWKSet fetches and refreshes
// automatically under the hood (with caching + re-fetch on rotation).
// We construct it lazily so that a deployment without GOOGLE_OAUTH_CLIENT_ID
// never touches the network at module-load time.
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null
function getGoogleJwks() {
  if (!cachedJwks) {
    cachedJwks = createRemoteJWKSet(new URL(GOOGLE_DISCOVERY_URL))
  }
  return cachedJwks
}

export interface GoogleIdTokenPayload {
  sub: string // stable Google user ID
  email: string
  emailVerified: boolean
  name?: string
  picture?: string
}

/**
 * Verify a Google ID token and return the safe fields.
 *
 * Verification per Google's docs (Verified Identity V1 cleanup — explicit
 * enforcement of all five claims listed in the task spec):
 *   - `iss`  MUST be `accounts.google.com` or `https://accounts.google.com`
 *            (enforced by jose's `issuer` option).
 *   - `aud`  MUST equal our OAuth Client ID (enforced by jose's `audience`
 *            option — jose rejects tokens where `aud` does not match).
 *   - `exp`  MUST be in the future (enforced by jose automatically —
 *            jwtVerify throws `JWTExpired` otherwise).
 *   - `sub`  MUST be present and non-empty (stable Google user ID — the
 *            unique account identifier we use as `providerSubject`).
 *   - `email` MUST be present and non-empty.
 *   - `email_verified` MUST be `true`. If Google says the email is not
 *            verified (rare — happens for some unverified Google Workspace
 *            accounts), we REFUSE to consider the identity verified and
 *            throw. The caller must NOT treat the token as a successful
 *            login when this throws. This check is INSIDE this function
 *            (not in the caller) so the verification contract is
 *            centralized — any future caller gets it for free.
 *   - Signature MUST validate against Google's JWKS (enforced by jose).
 *
 * Throws if ANY check fails. The caller should treat any throw as an
 * invalid token and return 401 (or redirect to a login-error page) —
 * never as a successful login.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string
): Promise<GoogleIdTokenPayload> {
  const { payload } = await jwtVerify(idToken, getGoogleJwks(), {
    issuer: ['accounts.google.com', 'https://accounts.google.com'],
    audience: clientId,
  })

  // jose enforces exp automatically via the `exp` claim — if the token
  // is past its `exp`, `jwtVerify` throws a `JWTExpired` error before
  // reaching this point. We additionally fail loud if `exp` is missing
  // entirely (a token without `exp` is structurally invalid and jose
  // would still accept it unless we explicitly require it).
  if (typeof payload.exp !== 'number' || payload.exp <= 0) {
    throw new Error('ID token missing or invalid exp claim')
  }

  // `sub` is the stable Google user ID. We use it as `providerSubject`
  // for the unique constraint, so it MUST be present and non-empty.
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('ID token missing sub claim')
  }

  // `email` is required for our identity model — we need to know which
  // email address this Google identity is asserting.
  if (typeof payload.email !== 'string' || payload.email.length === 0) {
    throw new Error('ID token missing email claim')
  }

  // `email_verified` MUST be `true`. If Google has not verified this
  // email at the identity-provider level, we refuse to consider the
  // identity verified. The caller (Google callback) treats this throw
  // as a non-success — it will redirect to /login?google_error=
  // email_not_verified. This is the trusted-authority assertion: we
  // set `emailVerifiedAt = now()` on the Anima Companion user record
  // based on this claim, so it MUST be `true` to do so.
  if (payload.email_verified !== true) {
    throw new Error('ID token email_verified claim is not true')
  }

  return {
    sub: payload.sub,
    email: payload.email,
    // We've already enforced `email_verified === true` above, so this
    // field is always `true` for any successfully-verified token. The
    // field is kept in the return type for documentation / future-proofing
    // (in case a future caller wants to assert it again).
    emailVerified: true,
    name: payload.name as string | undefined,
    picture: payload.picture as string | undefined,
  }
}

/**
 * Exchange an authorization code for tokens at Google's token endpoint.
 * Returns the `id_token` (which we verify) and `access_token` (which we
 * do NOT use — we don't need to call Google APIs on the user's behalf,
 * only to authenticate them).
 *
 * Throws on any non-2xx response from Google.
 */
export async function exchangeGoogleCodeForTokens(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<{ idToken: string; accessToken: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Google token exchange failed: ${res.status} ${errText.slice(0, 200)}`)
  }
  const data = await res.json()
  if (!data.id_token) throw new Error('Google token response missing id_token')
  return { idToken: data.id_token, accessToken: data.access_token }
}

/**
 * Build the Google consent-screen URL we redirect the user to.
 * Includes `state` (HMAC-signed by us, includes the safe-internal `next`
 * path so we can resume the user's navigation post-login) and `prompt`
 * set to `select_account` so users with multiple Google accounts are
 * asked which one to use.
 */
export function buildGoogleAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    // Force account picker — even if the user is signed in to one Google
    // account, give them the chance to pick a different one. Otherwise
    // the wrong account would silently be used for login.
    prompt: 'select_account',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Read Google OAuth config from env. Returns null if Google Sign-In is
 * not configured. The caller (login page + entry route) uses this to
 * decide whether to show the Google button / accept requests.
 *
 * Per the task spec: "Implementasikan sebanyak yang bisa dilakukan secara
 * benar tanpa fake email-delivery behavior." — same principle applies
 * to Google. If the env vars are missing, we do NOT fake a Google login.
 */
export function getGoogleOAuthConfig(): {
  clientId: string
  clientSecret: string
  redirectUri: string
} | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  // The redirect URI MUST be on the canonical app origin. We derive it
  // from NEXT_PUBLIC_SITE_URL (the same canonical origin used for SEO /
  // sitemap) so that Google's `redirect_uri` matches what's registered
  // in the Google Cloud Console.
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
  const redirectUri = `${origin}/api/auth/google/callback`
  return { clientId, clientSecret, redirectUri }
}
