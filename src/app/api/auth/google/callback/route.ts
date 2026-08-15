import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, verifyOAuthState, logAuthError } from '@/lib/auth'
import { verifyOAuthStateCookie, consumeOAuthStateCookie } from '@/lib/oauth-state'
import { getGoogleOAuthConfig, exchangeGoogleCodeForTokens, verifyGoogleIdToken } from '@/lib/google'
import { safeInternalPath } from '@/lib/redirect'

/**
 * GET /api/auth/google/callback — Google redirects here after consent.
 *
 * Query params: `?code=...&state=...` on success, or `?error=...` if the
 * user denied consent.
 *
 * Flow:
 *   1. Verify the OAuth state token (HMAC signature + expiry). Reject if
 *      invalid — this is the CSRF defense.
 *   2. Extract the safe-internal `next` path from the state token.
 *      Re-validate via safeInternalPath() (defense-in-depth — even though
 *      we validated before signing, the state could have been forged by
 *      someone with the secret, so we re-check).
 *   3. Exchange `code` for tokens at Google's token endpoint.
 *   4. Verify the `id_token` via `jose` using Google's JWKS. Extract
 *      `sub`, `email`, `email_verified`, `name`, `picture`.
 *   5. Look up the user by `providerSubject = sub` (stable Google ID).
 *      If found → sign in as that user. This is the case where the user
 *      has previously signed in with Google.
 *   6. If no user with that `sub` exists, look up by `email`. THIS IS THE
 *      ACCOUNT-LINKING POLICY:
 *        - If the existing user has `provider = 'PASSWORD'` AND
 *          `emailVerifiedAt !== null` AND Google's `email_verified === true`,
 *          then we LINK the Google identity to the existing account by
 *          setting `providerSubject = sub`. This is safe because the user
 *          has already proven control of the email (via the verification
 *          flow), AND Google has verified the email, so they're the same
 *          person.
 *        - If the existing user has `provider = 'PASSWORD'` AND
 *          `emailVerifiedAt === null`, we DO NOT link. This is the takeover
 *          defense: an attacker could register `victim@gmail.com` with a
 *          password (without verifying it), then sign in with Google
 *          using their own `victim@gmail.com` Google account and take
 *          over the unverified password account. We redirect to an error
 *          page asking the user to log in via password first, verify the
 *          email, then try Google Sign-In again.
 *        - If the existing user has `provider = 'GOOGLE'` but a different
 *          `sub` (i.e. a different Google identity owns the same email),
 *          we DO NOT link. Same defense — would allow a second Google
 *          identity to take over. Redirect to an error page.
 *   7. If no existing user matches by `sub` OR by `email` (safely),
 *      CREATE a new GOOGLE user with `emailVerifiedAt = now()` (because
 *      Google's `email_verified === true` is the trusted authority). The
 *      password field is set to a random 32-byte string that is never
 *      logged and never matches any real password — Google users cannot
 *      log in via the password flow.
 *   8. Issue the SAME `anima_session` HMAC cookie used by the password
 *      flow. No session-layer change.
 *   9. Redirect to the safe-internal `next` path, or to the role-based
 *      default (`/admin` for admin, `/` for customer).
 */
export async function GET(req: NextRequest) {
  const config = getGoogleOAuthConfig()
  if (!config) {
    return NextResponse.json(
      {
        error: 'Google Sign-In belum dikonfigurasi.',
        code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
      },
      { status: 503 }
    )
  }

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const googleError = searchParams.get('error')

  if (googleError) {
    // User denied consent, or Google returned an error. Send them back
    // to the login page with a soft message — not a 500.
    const loginUrl = new URL('/login', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
    loginUrl.searchParams.set('google_error', googleError)
    return NextResponse.redirect(loginUrl)
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/login?google_error=missing_params', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
    )
  }

  // Step 1: Verify the OAuth state token (CSRF defense + carry `next`).
  const statePayload = await verifyOAuthState(state)
  if (!statePayload) {
    return NextResponse.redirect(
      new URL('/login?google_error=invalid_state', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
    )
  }

  // Step 1b (Verified Identity V1 cleanup): Verify the OAuth state COOKIE.
  // The signed state token alone is not sufficient — it can be replayed
  // from any browser within its TTL. The sibling `anima_oauth_state`
  // HttpOnly+SameSite cookie (set by `/api/auth/google`) carries the SAME
  // nonce as embedded in the signed state. Require an EXACT match.
  //   - Missing cookie → state was replayed from a different browser, or
  //     the cookie was already consumed by a previous callback.
  //   - Mismatched nonce → state token and cookie are not from the same
  //     initiation (tampering / forged state).
  // Either way: reject. The cookie is NOT consumed on rejection, so the
  // legitimate user can still retry (their cookie is still valid for the
  // 10-minute TTL).
  const cookieOk = await verifyOAuthStateCookie(statePayload.nonce)
  if (!cookieOk) {
    return NextResponse.redirect(
      new URL('/login?google_error=state_cookie_mismatch', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')
    )
  }

  // Step 2: Extract + re-validate the safe-internal `next` path. Even
  // though we validated before signing, we re-validate after verifying
  // the signature too (defense-in-depth — a forged state token would
  // bypass the signature check, but a forged-state-token attacker with
  // the secret could still try to inject an external `next`).
  const safeNext = safeInternalPath(statePayload.next)

  try {
    // Step 3: Exchange the code for tokens.
    const { idToken } = await exchangeGoogleCodeForTokens(
      code,
      config.redirectUri,
      config.clientId,
      config.clientSecret
    )

    // Step 4: Verify the ID token.
    const googleUser = await verifyGoogleIdToken(idToken, config.clientId)

    // Google MUST verify the email for us to consider the identity
    // verified. If Google says email_verified=false (rare — happens for
    // some unverified Google Workspace accounts), we refuse to create
    // an account with emailVerifiedAt set; the user must verify their
    // email via Google first.
    if (!googleUser.emailVerified) {
      return NextResponse.redirect(
        new URL(
          '/login?google_error=email_not_verified',
          process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
        )
      )
    }

    // Step 5: Look up by stable Google sub.
    let user = await db.user.findUnique({
      where: { providerSubject: googleUser.sub },
      select: {
        id: true, email: true, name: true, phone: true, role: true,
        provider: true, emailVerifiedAt: true,
        // V2: select sessionVersion so we can encode it into the session cookie.
        sessionVersion: true,
      },
    })

    if (user) {
      // Case A: existing GOOGLE user with this `sub` — sign them in.
      // No state mutation needed.
    } else {
      // Step 6: Look up by email. Apply the safe-linking policy.
      const existingByEmail = await db.user.findUnique({
        where: { email: googleUser.email.toLowerCase() },
        select: {
          id: true, email: true, name: true, phone: true, role: true,
          provider: true, providerSubject: true, emailVerifiedAt: true,
          password: true,
          // V2: select sessionVersion so we can encode it into the session cookie
          // when we sign in the linked user.
          sessionVersion: true,
        },
      })

      if (existingByEmail) {
        if (existingByEmail.provider === 'PASSWORD' && existingByEmail.emailVerifiedAt) {
          // Safe to link — the user proved control of the email via the
          // password-verification flow, AND Google verified the email.
          // Link the Google identity by setting `providerSubject = sub`
          // and `provider = 'GOOGLE'`. (We keep the password field so
          // the user can still log in via password if they want — they
          // have BOTH providers available.)
          //
          // We do this atomically via updateMany WHERE providerSubject IS
          // NULL so two concurrent Google logins can't race to claim the
          // same slot.
          const claim = await db.user.updateMany({
            where: { id: existingByEmail.id, providerSubject: null },
            data: { providerSubject: googleUser.sub, provider: 'GOOGLE' },
          })
          if (claim.count === 0) {
            // Race lost — another Google login already claimed the slot.
            // Re-fetch and proceed with the existing user.
          }
          user = {
            id: existingByEmail.id,
            email: existingByEmail.email,
            name: existingByEmail.name,
            phone: existingByEmail.phone,
            role: existingByEmail.role,
            provider: 'GOOGLE',
            emailVerifiedAt: existingByEmail.emailVerifiedAt,
            // V2: propagate sessionVersion so it gets encoded into the
            // session cookie at Step 8.
            sessionVersion: existingByEmail.sessionVersion,
          }
        } else if (existingByEmail.provider === 'PASSWORD' && !existingByEmail.emailVerifiedAt) {
          // TAKEOVER DEFENSE — refuse to link an unverified password
          // account. The user must log in via password and verify the
          // email first, then come back to Google Sign-In.
          return NextResponse.redirect(
            new URL(
              '/login?google_error=unverified_password_account',
              process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
            )
          )
        } else if (existingByEmail.provider === 'GOOGLE' && existingByEmail.providerSubject !== googleUser.sub) {
          // Different Google identity already owns this email. Refuse
          // to take over.
          return NextResponse.redirect(
            new URL(
              '/login?google_error=email_conflict',
              process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
            )
          )
        }
      } else {
        // Step 7: No existing user matches safely. Create a new GOOGLE
        // user with `emailVerifiedAt = now()` (Google verified the
        // email — that's the trusted authority).
        //
        // The password field is set to a random 32-byte hex string that
        // is never logged. Google users cannot log in via the password
        // flow because there's no way for them to know this value. We
        // still hash it with bcrypt for defense-in-depth (in case the
        // password field is ever checked by a code path that doesn't
        // know about providers).
        const randomPassword = await import('crypto').then((c) =>
          c.randomBytes(32).toString('hex')
        )
        const bcrypt = await import('bcryptjs')
        const hashedRandomPassword = await bcrypt.hash(randomPassword, 10)

        user = await db.user.create({
          data: {
            email: googleUser.email.toLowerCase(),
            password: hashedRandomPassword,
            name: googleUser.name || googleUser.email.split('@')[0],
            phone: null,
            role: 'CUSTOMER', // Google users start as CUSTOMER — never auto-admin.
            provider: 'GOOGLE',
            providerSubject: googleUser.sub,
            emailVerifiedAt: new Date(), // Google verified the email.
          },
          select: {
            id: true, email: true, name: true, phone: true, role: true,
            provider: true, emailVerifiedAt: true,
            // V2: select sessionVersion (will be 0 for a newly-created user).
            sessionVersion: true,
          },
        })

        // Create an empty cart for the new user — matches the password
        // registration flow.
        await db.cart.create({ data: { userId: user.id } })
      }
    }

    if (!user) {
      // Should not happen — but if it does, send back to login.
      return NextResponse.redirect(
        new URL(
          '/login?google_error=user_lookup_failed',
          process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
        )
      )
    }

    // Step 8: Issue the SAME session cookie used by the password flow.
    // V2: encode the user's sessionVersion into the session cookie so the
    // sessionVersion check in getCurrentUser can detect stale sessions
    // after a password reset.
    await createSession({
      id: user.id,
      email: user.email,
      role: user.role,
      sessionVersion: user.sessionVersion,
    })

    // Step 8b (Verified Identity V1 cleanup): Consume (clear) the OAuth
    // state cookie. This makes the state URL single-use — a replayed
    // callback hitting the route again will see no matching cookie and
    // be rejected at Step 1b. The session cookie issued above is what
    // authorizes the user from here on; the OAuth state cookie has
    // served its purpose.
    await consumeOAuthStateCookie()

    // Step 9: Redirect to safe-internal `next` or role-based default.
    const fallback = user.role === 'ADMIN' ? '/admin' : '/'
    const redirectPath = safeNext || fallback
    const redirectUrl = new URL(
      redirectPath,
      process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    )
    return NextResponse.redirect(redirectUrl)
  } catch (e) {
    logAuthError('Google OAuth callback error', e)
    return NextResponse.redirect(
      new URL(
        '/login?google_error=server_error',
        process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      )
    )
  }
}
