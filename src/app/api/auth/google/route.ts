import { NextRequest, NextResponse } from 'next/server'
import { createOAuthState } from '@/lib/auth'
import { getGoogleOAuthConfig, buildGoogleAuthUrl } from '@/lib/google'
import { safeInternalPath } from '@/lib/redirect'

/**
 * GET /api/auth/google — entry point for Google Sign-In.
 *
 * Behavior:
 *   1. Read `?next=...` from query. Validate via safeInternalPath() — the
 *      same open-redirect defense used by LoginView. Unsafe / external
 *      values are dropped (null), and the user is sent to `/` after login.
 *   2. Sign the safe-internal `next` path into an OAuth state token
 *      (HMAC-SHA-256, 10-min TTL). The state token prevents CSRF and
 *      carries the post-login destination through Google's redirect.
 *   3. Redirect (302) to Google's consent screen with `client_id`,
 *      `redirect_uri`, `response_type=code`, `scope=openid email profile`,
 *      `prompt=select_account`, and `state=<signedStateToken>`.
 *
 * If Google OAuth is not configured (env vars missing), returns 503 with
 * a clear config-missing message. The login page also hides the Google
 * button in this case via /api/auth/google-config.
 */
export async function GET(req: NextRequest) {
  const config = getGoogleOAuthConfig()
  if (!config) {
    return NextResponse.json(
      {
        error: 'Google Sign-In belum dikonfigurasi. Set GOOGLE_OAUTH_CLIENT_ID dan GOOGLE_OAUTH_CLIENT_SECRET di environment variables.',
        code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
      },
      { status: 503 }
    )
  }

  // Validate the `next` param using the SAME open-redirect defense the
  // login/register pages use. This is the unified boundary.
  const rawNext = req.nextUrl.searchParams.get('next')
  const safeNext = safeInternalPath(rawNext)

  // Sign the safe-internal next path into the OAuth state. If safeNext is
  // null (unsafe / missing / external), we still issue a state token but
  // with `next: null` — the callback will then send the user to the
  // role-based default (`/admin` for admin, `/` for customer).
  const state = await createOAuthState(safeNext)

  const authUrl = buildGoogleAuthUrl(
    config.clientId,
    config.redirectUri,
    state
  )
  return NextResponse.redirect(authUrl)
}
