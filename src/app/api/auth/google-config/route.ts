import { NextResponse } from 'next/server'
import { getGoogleOAuthConfig } from '@/lib/google'

/**
 * GET /api/auth/google-config — public config check.
 *
 * Returns `{ enabled: boolean }`. The login page uses this to decide
 * whether to render the "Sign in with Google" button. If Google OAuth
 * env vars are not set, `enabled` is false and the button is hidden —
 * we do NOT fake a Google login when it's unconfigured.
 *
 * This endpoint is intentionally public (no auth) — it only reveals
 * whether Google OAuth is configured, not any credentials.
 */
export async function GET() {
  const config = getGoogleOAuthConfig()
  return NextResponse.json({
    enabled: !!config,
  })
}
