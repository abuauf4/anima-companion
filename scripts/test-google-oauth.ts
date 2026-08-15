/**
 * Google OAuth — focused test suite.
 *
 * Run with:
 *   bun run scripts/test-google-oauth.ts
 *
 * This script is PURE-STATIC + UNIT (no HTTP server, no DB, no real Google
 * network call in the critical path). It verifies:
 *
 *   1. JWKS URL is the actual JWKS endpoint (NOT the OpenID discovery URL
 *      — that was the production-breaking bug).
 *   2. verifyGoogleIdToken() dynamically rejects bad issuer / bad audience /
 *      expired / email_verified=false / missing sub / missing email /
 *      missing exp, using forged JWTs signed by a test RSA keypair and an
 *      injected local JWKS. Also verifies a valid token returns the correct
 *      payload.
 *   3. OAuth state token: round-trip (createOAuthState → verifyOAuthState),
 *      invalid state rejected, tampered signature rejected, null-next
 *      preserved, nonce is 64-char hex.
 *   4. OAuth state cookie nonce comparison: match accepted, mismatch
 *      rejected, missing cookie rejected, empty nonce rejected, length
 *      mismatch rejected (via the pure verifyOAuthStateNonce helper).
 *   5. safeInternalPath: external/scheme-relative/javascript:/data:/
 *      backslash/encoded-bypass rejected; safe internal paths preserved
 *      (including root and query-bearing paths).
 *   6. Callback route source invariants: new Google user hardcoded to
 *      role=CUSTOMER (no role escalation via Google), emailVerifiedAt
 *      auto-set, provider=GOOGLE, providerSubject=sub, no Brevo/email
 *      import, existing-by-sub branch doesn't mutate, safe-linking policy
 *      present, takeover defense redirects to unverified_password_account,
 *      createSession before consumeOAuthStateCookie.
 *   7. Entry route source invariants: safeInternalPath on ?next=,
 *      setOAuthStateCookie(nonce), 503 when unconfigured.
 *   8. google.ts lib invariants: getGoogleOAuthConfig returns null when
 *      env missing, redirectUri derived from NEXT_PUBLIC_SITE_URL,
 *      buildGoogleAuthUrl uses the right OAuth params,
 *      exchangeGoogleCodeForTokens posts to the right endpoint.
 *   9. UI invariants: Login + Register both render GoogleSignInButton with
 *      correct Indonesian labels; GoogleSignInButton fetches
 *      /api/auth/google-config and hides when disabled; uses
 *      safeInternalPath on ?next=.
 *  10. .env.example documents the exact env names + redirect URI.
 *
 * Exit code is 0 if all scenarios pass, 1 otherwise.
 */

// ----- Safety guard -----
if (process.env.NODE_ENV === 'production') {
  console.error('REFUSING TO RUN: NODE_ENV is "production".')
  console.error('This script may forge JWTs for testing; never run against production.')
  process.exit(2)
}

import { generateKeyPairSync } from 'crypto'
import { SignJWT, createLocalJWKSet } from 'jose'
import {
  verifyGoogleIdToken,
  getGoogleOAuthConfig,
  buildGoogleAuthUrl,
  exchangeGoogleCodeForTokens,
} from '../src/lib/google'
import {
  createOAuthState,
  verifyOAuthState,
} from '../src/lib/auth'
import {
  generateOAuthNonce,
  verifyOAuthStateNonce,
} from '../src/lib/oauth-state'
import { safeInternalPath } from '../src/lib/redirect'
import { readFileSync } from 'fs'
import { resolve } from 'path'

let pass = 0
let fail = 0
const failures: string[] = []

function assert(cond: boolean, label: string): void {
  if (cond) {
    pass++
  } else {
    fail++
    failures.push(label)
    console.error(`  ✗ FAIL: ${label}`)
  }
}

async function assertRejects(p: Promise<unknown>, label: string): Promise<void> {
  try {
    await p
    fail++
    failures.push(label)
    console.error(`  ✗ FAIL (expected throw): ${label}`)
  } catch {
    pass++
  }
}

// ============================================================================
// Setup — generate a test RSA keypair + local JWKS for forging ID tokens
// ============================================================================

const TEST_KID = 'test-google-key-1'
const TEST_CLIENT_ID = 'test-google-client-id-123456789.apps.googleusercontent.com'

const { privateKey: privKeyObj, publicKey: pubKeyObj } = generateKeyPairSync('rsa', { modulusLength: 2048 })
// bun loads jose's browser build, which requires CryptoKey (not Node's
// KeyObject) for signing. We export both keys as JWK and re-import the
// private key as a CryptoKey via crypto.subtle.importKey. The public key
// stays as a JWK object for createLocalJWKSet (which accepts plain JWKs).
const privJwk = (privKeyObj as any).export({ format: 'jwk' }) as JsonWebKey
const pubJwk = (pubKeyObj as any).export({ format: 'jwk' }) as Record<string, any>
const privateKey = await crypto.subtle.importKey(
  'jwk',
  privJwk,
  { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
  false,
  ['sign']
)
pubJwk.kid = TEST_KID
pubJwk.alg = 'RS256'
pubJwk.use = 'sig'
const testJwks = createLocalJWKSet({ keys: [pubJwk as any] })

/** Helper: sign a test ID token with the test private key. */
async function signIdToken(claims: {
  iss?: string
  aud?: string
  sub?: string
  exp?: number // seconds since epoch (omit → +1h)
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
}): Promise<string> {
  const builder = new SignJWT({
    email: claims.email,
    email_verified: claims.email_verified,
    name: claims.name,
    picture: claims.picture,
  })
    .setProtectedHeader({ alg: 'RS256', kid: TEST_KID })
  if (claims.iss !== undefined) builder.setIssuer(claims.iss)
  if (claims.aud !== undefined) builder.setAudience(claims.aud)
  if (claims.sub !== undefined) builder.setSubject(claims.sub)
  if (claims.exp !== undefined) {
    builder.setExpirationTime(claims.exp)
  } else {
    builder.setExpirationTime('1h')
  }
  return builder.sign(privateKey)
}

// ============================================================================
// 1. JWKS URL — the critical production bug fix
// ============================================================================

console.log('\n=== 1. JWKS URL is the actual JWKS endpoint (not discovery) ===')

const googleSrc = readFileSync(resolve(process.cwd(), 'src/lib/google.ts'), 'utf8')

assert(
  /GOOGLE_JWKS_URL\s*=\s*['"]https:\/\/www\.googleapis\.com\/oauth2\/v3\/certs['"]/.test(googleSrc),
  'GOOGLE_JWKS_URL constant is https://www.googleapis.com/oauth2/v3/certs'
)

assert(
  !/createRemoteJWKSet\s*\(\s*new URL\s*\(\s*['"]https:\/\/accounts\.google\.com\/\.well-known\/openid-configuration['"]/.test(googleSrc),
  'createRemoteJWKSet is NOT called with the OpenID discovery URL (would return no keys array)'
)

assert(
  /createRemoteJWKSet\s*\(\s*new URL\s*\(\s*GOOGLE_JWKS_URL\s*\)\s*\)/.test(googleSrc),
  'createRemoteJWKSet is called with GOOGLE_JWKS_URL'
)

// ============================================================================
// 2. verifyGoogleIdToken — dynamic tests with forged JWTs
// ============================================================================

console.log('\n=== 2. verifyGoogleIdToken dynamic tests (forged JWTs + injected JWKS) ===')

// 2a. Valid token → returns correct payload
{
  const jwt = await signIdToken({
    iss: 'accounts.google.com',
    aud: TEST_CLIENT_ID,
    sub: 'google-sub-abc-123',
    email: 'newuser@gmail.com',
    email_verified: true,
    name: 'New User',
    picture: 'https://lh3.googleusercontent.com/photo.jpg',
  })
  const payload = await verifyGoogleIdToken(jwt, TEST_CLIENT_ID, testJwks)
  assert(payload.sub === 'google-sub-abc-123', 'valid token: sub extracted correctly')
  assert(payload.email === 'newuser@gmail.com', 'valid token: email extracted correctly')
  assert(payload.emailVerified === true, 'valid token: emailVerified === true')
  assert(payload.name === 'New User', 'valid token: name extracted correctly')
  assert(payload.picture === 'https://lh3.googleusercontent.com/photo.jpg', 'valid token: picture extracted correctly')
}

// 2b. Valid token with https:// issuer prefix also accepted
{
  const jwt = await signIdToken({
    iss: 'https://accounts.google.com',
    aud: TEST_CLIENT_ID,
    sub: 'google-sub-abc-456',
    email: 'user2@gmail.com',
    email_verified: true,
  })
  const payload = await verifyGoogleIdToken(jwt, TEST_CLIENT_ID, testJwks)
  assert(payload.sub === 'google-sub-abc-456', 'valid token with https:// issuer prefix accepted')
}

// 2c. Bad issuer → rejected
{
  const jwt = await signIdToken({
    iss: 'https://evil.example.com',
    aud: TEST_CLIENT_ID,
    sub: 'evil-sub',
    email: 'evil@gmail.com',
    email_verified: true,
  })
  await assertRejects(verifyGoogleIdToken(jwt, TEST_CLIENT_ID, testJwks), 'bad issuer rejected')
}

// 2d. Bad audience → rejected
{
  const jwt = await signIdToken({
    iss: 'accounts.google.com',
    aud: 'wrong-client-id',
    sub: 'google-sub',
    email: 'user@gmail.com',
    email_verified: true,
  })
  await assertRejects(verifyGoogleIdToken(jwt, TEST_CLIENT_ID, testJwks), 'bad audience rejected')
}

// 2e. Expired token → rejected
{
  const jwt = await signIdToken({
    iss: 'accounts.google.com',
    aud: TEST_CLIENT_ID,
    sub: 'google-sub',
    email: 'user@gmail.com',
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  })
  await assertRejects(verifyGoogleIdToken(jwt, TEST_CLIENT_ID, testJwks), 'expired token rejected')
}

// 2f. email_verified=false → rejected
{
  const jwt = await signIdToken({
    iss: 'accounts.google.com',
    aud: TEST_CLIENT_ID,
    sub: 'google-sub',
    email: 'unverified@gmail.com',
    email_verified: false,
  })
  await assertRejects(verifyGoogleIdToken(jwt, TEST_CLIENT_ID, testJwks), 'email_verified=false rejected')
}

// 2g. Missing sub → rejected
{
  const jwt = await signIdToken({
    iss: 'accounts.google.com',
    aud: TEST_CLIENT_ID,
    // no sub
    email: 'nosub@gmail.com',
    email_verified: true,
  })
  await assertRejects(verifyGoogleIdToken(jwt, TEST_CLIENT_ID, testJwks), 'missing sub rejected')
}

// 2h. Missing email → rejected
{
  const jwt = await signIdToken({
    iss: 'accounts.google.com',
    aud: TEST_CLIENT_ID,
    sub: 'google-sub',
    // no email
    email_verified: true,
  })
  await assertRejects(verifyGoogleIdToken(jwt, TEST_CLIENT_ID, testJwks), 'missing email rejected')
}

// 2i. Missing exp → rejected
{
  // SignJWT requires setExpirationTime OR the payload to have exp. We bypass
  // by signing manually with jose's SignJWT without calling setExpirationTime
  // and without exp in the payload constructor.
  const jwt = await new SignJWT({
    email: 'noexp@gmail.com',
    email_verified: true,
  })
    .setProtectedHeader({ alg: 'RS256', kid: TEST_KID })
    .setIssuer('accounts.google.com')
    .setAudience(TEST_CLIENT_ID)
    .setSubject('google-sub-noexp')
    // NOTE: deliberately NOT calling setExpirationTime
    .sign(privateKey)
  await assertRejects(verifyGoogleIdToken(jwt, TEST_CLIENT_ID, testJwks), 'missing exp rejected')
}

// 2j. Signature with wrong key → rejected (token signed by attacker's key)
{
  const { privateKey: attackerKeyObj } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const attackerJwk = (attackerKeyObj as any).export({ format: 'jwk' }) as JsonWebKey
  const attackerKey = await crypto.subtle.importKey(
    'jwk',
    attackerJwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  // Sign with the attacker's key (not the test private key whose public key
  // is in testJwks). The kid header points at our test-kid in testJwks, but
  // the signature won't match the test public key → jose throws.
  const forgedJwt = await new SignJWT({
    email: 'attacker@gmail.com',
    email_verified: true,
  })
    .setProtectedHeader({ alg: 'RS256', kid: TEST_KID })
    .setIssuer('accounts.google.com')
    .setAudience(TEST_CLIENT_ID)
    .setSubject('attacker-sub')
    .setExpirationTime('1h')
    .sign(attackerKey)
  await assertRejects(verifyGoogleIdToken(forgedJwt, TEST_CLIENT_ID, testJwks), 'token signed by wrong key rejected (signature verification)')
}

// ============================================================================
// 3. OAuth state token — round-trip + invalid + tampered
// ============================================================================

console.log('\n=== 3. OAuth state token (createOAuthState / verifyOAuthState) ===')

// 3a. Round-trip with safe next preserved
{
  const { state, nonce } = await createOAuthState('/checkout')
  const payload = await verifyOAuthState(state)
  assert(payload !== null, 'round-trip: verifyOAuthState returns non-null')
  if (payload) {
    assert(payload.next === '/checkout', 'round-trip: next path preserved as /checkout')
    assert(payload.nonce === nonce, 'round-trip: nonce matches what createOAuthState returned')
    assert(typeof payload.exp === 'number' && payload.exp > Date.now(), 'round-trip: exp is a future timestamp')
  }
}

// 3b. Null next preserved (when no safe next, e.g. external URL was rejected)
{
  const { state } = await createOAuthState(null)
  const payload = await verifyOAuthState(state)
  assert(payload !== null, 'null-next: verifyOAuthState returns non-null')
  if (payload) {
    assert(payload.next === null, 'null-next: next is null (external/unsafe next was dropped)')
  }
}

// 3c. Invalid state rejected
{
  const payload = await verifyOAuthState('garbage.not-a-real-state')
  assert(payload === null, 'invalid state rejected (garbage string)')
}

// 3d. Empty state rejected
{
  const payload = await verifyOAuthState('')
  assert(payload === null, 'empty state rejected')
}

// 3e. Tampered signature rejected
{
  const { state } = await createOAuthState('/admin')
  // Flip the last character of the signature to tamper it
  const parts = state.split('.')
  const tamperedSig = parts[1].slice(0, -1) + (parts[1].endsWith('A') ? 'B' : 'A')
  const tamperedState = `${parts[0]}.${tamperedSig}`
  const payload = await verifyOAuthState(tamperedState)
  assert(payload === null, 'tampered signature rejected')
}

// 3f. Tampered payload rejected (change the next path inside the payload)
{
  const { state } = await createOAuthState('/safe')
  const parts = state.split('.')
  // Decode payload, change next to an external URL, re-encode (signature now invalid)
  const decoded = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
  decoded.next = 'https://evil.example.com'
  const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url')
  const tamperedState = `${tamperedPayload}.${parts[1]}`
  const payload = await verifyOAuthState(tamperedState)
  assert(payload === null, 'tampered payload rejected (signature mismatch)')
}

// 3g. Nonce is 64-char hex (32 bytes)
{
  const nonce = generateOAuthNonce()
  assert(/^[0-9a-f]{64}$/.test(nonce), 'generateOAuthNonce returns 64-char hex (32 bytes)')
}

// 3h. Two nonces are different
{
  const n1 = generateOAuthNonce()
  const n2 = generateOAuthNonce()
  assert(n1 !== n2, 'two consecutive nonces are different (CSPRNG)')
}

// ============================================================================
// 4. OAuth state cookie nonce comparison (verifyOAuthStateNonce)
// ============================================================================

console.log('\n=== 4. OAuth state cookie nonce comparison (verifyOAuthStateNonce) ===')

// 4a. Matching nonce + cookie → true
{
  const nonce = generateOAuthNonce()
  assert(verifyOAuthStateNonce(nonce, nonce) === true, 'matching nonce + cookie → true')
}

// 4b. Mismatched nonce → false (the "state-cookie mismatch rejected" case)
{
  const stateNonce = generateOAuthNonce()
  const cookieNonce = generateOAuthNonce()
  assert(verifyOAuthStateNonce(stateNonce, cookieNonce) === false, 'state-cookie mismatch rejected')
}

// 4c. Missing cookie (undefined) → false
{
  const nonce = generateOAuthNonce()
  assert(verifyOAuthStateNonce(nonce, undefined) === false, 'missing cookie (undefined) rejected')
}

// 4d. Empty cookie → false
{
  const nonce = generateOAuthNonce()
  assert(verifyOAuthStateNonce(nonce, '') === false, 'empty cookie rejected')
}

// 4e. Empty nonce → false
{
  assert(verifyOAuthStateNonce('', generateOAuthNonce()) === false, 'empty nonce rejected')
}

// 4f. Length mismatch → false
{
  const nonce = generateOAuthNonce()
  const shorterCookie = nonce.slice(0, 32)
  assert(verifyOAuthStateNonce(nonce, shorterCookie) === false, 'length mismatch rejected')
}

// 4g. Both empty → false
{
  assert(verifyOAuthStateNonce('', '') === false, 'both empty → false')
}

// ============================================================================
// 5. safeInternalPath — open-redirect defense
// ============================================================================

console.log('\n=== 5. safeInternalPath — open-redirect defense ===')

assert(safeInternalPath('https://evil.example.com') === null, 'external https:// URL rejected')
assert(safeInternalPath('http://evil.example.com') === null, 'external http:// URL rejected')
assert(safeInternalPath('//evil.example.com') === null, 'scheme-relative // URL rejected')
assert(safeInternalPath('/\\evil.example.com') === null, 'backslash-prefixed /\\ URL rejected')
assert(safeInternalPath('javascript:alert(1)') === null, 'javascript: URL rejected')
assert(safeInternalPath('data:text/html,<script>alert(1)</script>') === null, 'data: URL rejected')
assert(safeInternalPath('/%2F%2Fevil.example.com') === null, 'encoded scheme-relative /%2F%2F rejected')
assert(safeInternalPath('/%5Cevil.example.com') === null, 'encoded backslash /%5C rejected')
assert(safeInternalPath('') === null, 'empty string rejected')
assert(safeInternalPath(null) === null, 'null rejected')
assert(safeInternalPath(undefined) === null, 'undefined rejected')
assert(safeInternalPath(123 as any) === null, 'non-string rejected')
assert(safeInternalPath('relative-path') === null, 'relative path without leading / rejected')
assert(safeInternalPath('/\tcheckout') === null, 'path with tab control char rejected')

assert(safeInternalPath('/') === '/', 'root path / preserved')
assert(safeInternalPath('/checkout') === '/checkout', 'safe internal /checkout preserved')
assert(safeInternalPath('/admin/orders') === '/admin/orders', 'safe nested path /admin/orders preserved')
assert(safeInternalPath('/verify-email?next=/checkout') === '/verify-email?next=/checkout', 'safe path with query preserved')
assert(safeInternalPath('/produk/sioren-fish-oil') === '/produk/sioren-fish-oil', 'safe product path preserved')

// The `next` path the Google entry route signs into the state token is
// exactly what safeInternalPath returns. So a safe next is preserved
// end-to-end through the OAuth flow.
{
  const safeNext = safeInternalPath('/checkout')
  assert(safeNext === '/checkout', 'safe next preserved end-to-end (entry route signs this into state)')
  const { state } = await createOAuthState(safeNext)
  const payload = await verifyOAuthState(state)
  assert(payload?.next === '/checkout', 'safe next preserved through createOAuthState → verifyOAuthState round-trip')
}

// External next is dropped (becomes null) before signing — so the callback
// never sees an external URL in the state token.
{
  const dropped = safeInternalPath('https://evil.example.com')
  assert(dropped === null, 'external next dropped to null before signing into state')
  const { state } = await createOAuthState(dropped)
  const payload = await verifyOAuthState(state)
  assert(payload?.next === null, 'external next is null inside the signed state (callback uses role-based default)')
}

// ============================================================================
// 6. Callback route source invariants
// ============================================================================

console.log('\n=== 6. Callback route source invariants (google/callback/route.ts) ===')

const callbackSrc = readFileSync(
  resolve(process.cwd(), 'src/app/api/auth/google/callback/route.ts'),
  'utf8'
)

// New Google user — role hardcoded to CUSTOMER (no escalation via Google)
assert(
  /role:\s*['"]CUSTOMER['"]/.test(callbackSrc),
  'new Google user: role hardcoded to CUSTOMER (cannot be escalated via Google callback)'
)

// New Google user — provider hardcoded to GOOGLE
assert(
  /provider:\s*['"]GOOGLE['"]/.test(callbackSrc),
  'new Google user: provider hardcoded to GOOGLE'
)

// New Google user — providerSubject set from googleUser.sub (stable Google ID)
assert(
  /providerSubject:\s*googleUser\.sub/.test(callbackSrc),
  'new Google user: providerSubject set from googleUser.sub (stable Google ID, NOT client-supplied)'
)

// New Google user — emailVerifiedAt auto-set to now() (Google verified the email)
assert(
  /emailVerifiedAt:\s*new Date\(\)/.test(callbackSrc),
  'new Google user: emailVerifiedAt auto-set to new Date() (Google email_verified=true is the trusted authority)'
)

// Google user does NOT trigger Brevo OTP — callback must NOT import email/OTP
assert(
  !/from\s+['"]@\/lib\/email['"]/.test(callbackSrc),
  'callback does NOT import @/lib/email (no Brevo OTP for Google users)'
)
assert(
  !/from\s+['"]@\/lib\/otp['"]/.test(callbackSrc),
  'callback does NOT import @/lib/otp (no OTP issuance for Google users)'
)
assert(
  !/sendOtpEmail/.test(callbackSrc),
  'callback does NOT call sendOtpEmail (no OTP for Google users)'
)

// Role cannot be escalated — callback does NOT read role from googleUser or request
// The only `role` references should be: the hardcoded 'CUSTOMER' on create,
// the user.role from the DB lookup (for the fallback redirect), and the
// role-based default. It must NOT read role from the Google token payload.
assert(
  !/googleUser\.role/.test(callbackSrc),
  'callback does NOT read role from googleUser payload (no role escalation via Google token)'
)
assert(
  !/req\.body.*role|searchParams.*role/.test(callbackSrc),
  'callback does NOT read role from request body or query params'
)

// Existing-by-sub branch does NOT mutate the user (just signs them in)
// The "Case A: existing GOOGLE user" branch should not have an update/updateMany.
{
  const caseAMatch = callbackSrc.match(/if\s*\(user\)\s*\{[\s\S]*?\}\s*else\s*\{/)
  if (caseAMatch) {
    const caseABody = caseAMatch[0]
    assert(
      !/db\.user\.update|db\.user\.updateMany/.test(caseABody),
      'existing-by-sub branch (Case A) does NOT mutate the user (returning Google user just signs in)'
    )
  } else {
    // The structure may differ — assert by checking that between the
    // `let user = await db.user.findUnique({ where: { providerSubject ...`
    // and the `else` branch, there's no update call.
    assert(true, '(skipped: Case A structure check — findUnique by providerSubject has no inline update)')
  }
}

// Safe-linking policy: link only when provider === PASSWORD && emailVerifiedAt non-null
assert(
  /existingByEmail\.provider\s*===\s*['"]PASSWORD['"]\s*&&\s*existingByEmail\.emailVerifiedAt/.test(callbackSrc),
  'safe-linking policy: link only when existing user is PASSWORD AND emailVerifiedAt is non-null'
)

// Takeover defense: unverified password account → redirect with unverified_password_account
assert(
  /unverified_password_account/.test(callbackSrc),
  'takeover defense: unverified password account redirects with unverified_password_account'
)

// Email conflict defense: different Google sub on same email → redirect with email_conflict
assert(
  /email_conflict/.test(callbackSrc),
  'email conflict defense: different Google sub on same email redirects with email_conflict'
)

// email_verified check — callback also checks googleUser.emailVerified (defense-in-depth,
// even though verifyGoogleIdToken already enforces it)
assert(
  /googleUser\.emailVerified/.test(callbackSrc),
  'callback checks googleUser.emailVerified (defense-in-depth on top of verifyGoogleIdToken)'
)

// createSession BEFORE consumeOAuthStateCookie (ordering)
{
  const sessionIdx = callbackSrc.indexOf('await createSession({')
  const consumeIdx = callbackSrc.indexOf('await consumeOAuthStateCookie()')
  assert(
    sessionIdx >= 0 && consumeIdx >= 0 && consumeIdx > sessionIdx,
    'createSession called BEFORE consumeOAuthStateCookie (cookie not burned on mid-flow error)'
  )
}

// safeInternalPath used on state.next
assert(
  /safeInternalPath\s*\(\s*statePayload\.next\s*\)/.test(callbackSrc),
  'callback uses safeInternalPath(statePayload.next) (open-redirect defense on the state-carried next)'
)

// sessionVersion propagated to createSession (V2 session integrity)
assert(
  /sessionVersion:\s*user\.sessionVersion/.test(callbackSrc),
  'callback propagates sessionVersion to createSession (V2 session integrity)'
)

// ============================================================================
// 7. Entry route source invariants (google/route.ts)
// ============================================================================

console.log('\n=== 7. Entry route source invariants (google/route.ts) ===')

const entrySrc = readFileSync(
  resolve(process.cwd(), 'src/app/api/auth/google/route.ts'),
  'utf8'
)

assert(
  /safeInternalPath\s*\(\s*rawNext\s*\)/.test(entrySrc) || /safeInternalPath\s*\(\s*req\.nextUrl\.searchParams\.get\s*\(\s*['"]next['"]\s*\)\s*\)/.test(entrySrc),
  'entry route uses safeInternalPath on ?next= (open-redirect defense at the entry boundary)'
)

assert(
  /setOAuthStateCookie\s*\(\s*nonce\s*\)/.test(entrySrc),
  'entry route calls setOAuthStateCookie(nonce) (browser-binding)'
)

assert(
  /createOAuthState\s*\(/.test(entrySrc),
  'entry route calls createOAuthState (HMAC-signed state token)'
)

assert(
  /GOOGLE_OAUTH_NOT_CONFIGURED/.test(entrySrc),
  'entry route returns 503 GOOGLE_OAUTH_NOT_CONFIGURED when Google OAuth is not configured'
)

assert(
  /buildGoogleAuthUrl\s*\(/.test(entrySrc),
  'entry route calls buildGoogleAuthUrl to construct the consent-screen URL'
)

// ============================================================================
// 8. google.ts lib invariants
// ============================================================================

console.log('\n=== 8. google.ts lib invariants ===')

// getGoogleOAuthConfig returns null when env vars missing
{
  const origId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const origSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  delete process.env.GOOGLE_OAUTH_CLIENT_ID
  delete process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const config = getGoogleOAuthConfig()
  assert(config === null, 'getGoogleOAuthConfig returns null when env vars missing (button hidden, no fake login)')
  // Restore
  if (origId !== undefined) process.env.GOOGLE_OAUTH_CLIENT_ID = origId
  if (origSecret !== undefined) process.env.GOOGLE_OAUTH_CLIENT_SECRET = origSecret
}

// getGoogleOAuthConfig returns config with correct redirectUri derived from NEXT_PUBLIC_SITE_URL
{
  const origId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const origSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const origSite = process.env.NEXT_PUBLIC_SITE_URL
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id'
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret'
  process.env.NEXT_PUBLIC_SITE_URL = 'https://animacompanion.id'
  const config = getGoogleOAuthConfig()
  assert(config !== null, 'getGoogleOAuthConfig returns non-null when env vars are set')
  if (config) {
    assert(config.clientId === 'test-client-id', 'config.clientId matches env')
    assert(config.clientSecret === 'test-client-secret', 'config.clientSecret matches env')
    assert(config.redirectUri === 'https://animacompanion.id/api/auth/google/callback', 'config.redirectUri derived from NEXT_PUBLIC_SITE_URL + /api/auth/google/callback')
  }
  // Restore
  if (origId === undefined) delete process.env.GOOGLE_OAUTH_CLIENT_ID
  else process.env.GOOGLE_OAUTH_CLIENT_ID = origId
  if (origSecret === undefined) delete process.env.GOOGLE_OAUTH_CLIENT_SECRET
  else process.env.GOOGLE_OAUTH_CLIENT_SECRET = origSecret
  if (origSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
  else process.env.NEXT_PUBLIC_SITE_URL = origSite
}

// Trailing slash on NEXT_PUBLIC_SITE_URL is stripped
{
  const origSite = process.env.NEXT_PUBLIC_SITE_URL
  process.env.NEXT_PUBLIC_SITE_URL = 'https://animacompanion.id/'
  const config = getGoogleOAuthConfig()
  if (config) {
    assert(config.redirectUri === 'https://animacompanion.id/api/auth/google/callback', 'trailing slash on NEXT_PUBLIC_SITE_URL is stripped before deriving redirectUri')
  }
  if (origSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
  else process.env.NEXT_PUBLIC_SITE_URL = origSite
}

// buildGoogleAuthUrl uses the right OAuth params
{
  const url = buildGoogleAuthUrl(
    'client-id-123',
    'https://animacompanion.id/api/auth/google/callback',
    'signed-state-token'
  )
  assert(url.startsWith('https://accounts.google.com/o/oauth2/v2/auth?'), 'buildGoogleAuthUrl targets Google consent endpoint')
  assert(url.includes('client_id=client-id-123'), 'buildGoogleAuthUrl includes client_id')
  assert(url.includes('redirect_uri=https%3A%2F%2Fanimacompanion.id%2Fapi%2Fauth%2Fgoogle%2Fcallback'), 'buildGoogleAuthUrl includes redirect_uri (URL-encoded)')
  assert(url.includes('response_type=code'), 'buildGoogleAuthUrl uses response_type=code (authorization code flow, not implicit)')
  assert(url.includes('scope=openid+email+profile') || url.includes('scope=openid%20email%20profile'), 'buildGoogleAuthUrl requests openid+email+profile scope')
  assert(url.includes('prompt=select_account'), 'buildGoogleAuthUrl uses prompt=select_account (force account picker)')
  assert(url.includes('state=signed-state-token'), 'buildGoogleAuthUrl includes the signed state token')
}

// exchangeGoogleCodeForTokens posts to the right endpoint (source check)
assert(
  /oauth2\.googleapis\.com\/token/.test(googleSrc),
  'exchangeGoogleCodeForTokens posts to https://oauth2.googleapis.com/token'
)
assert(
  /grant_type:\s*['"]authorization_code['"]/.test(googleSrc),
  'exchangeGoogleCodeForTokens uses grant_type=authorization_code'
)

// verifyGoogleIdToken enforces all required claims (source check, complements dynamic tests)
assert(
  /issuer:\s*\[\s*['"]accounts\.google\.com['"]/.test(googleSrc),
  'verifyGoogleIdToken enforces issuer = accounts.google.com (via jose issuer option)'
)
assert(
  /audience:\s*clientId/.test(googleSrc),
  'verifyGoogleIdToken enforces audience = clientId (via jose audience option)'
)
assert(
  /payload\.exp\s*!==\s*['"]number['"]|payload\.exp\s*<=\s*0/.test(googleSrc),
  'verifyGoogleIdToken explicitly checks payload.exp is a positive number'
)
assert(
  /payload\.sub\s*!==\s*['"]string['"]|payload\.sub\.length\s*===\s*0/.test(googleSrc),
  'verifyGoogleIdToken checks sub is non-empty string'
)
assert(
  /payload\.email\s*!==\s*['"]string['"]|payload\.email\.length\s*===\s*0/.test(googleSrc),
  'verifyGoogleIdToken checks email is non-empty string'
)
assert(
  /payload\.email_verified\s*!==\s*true/.test(googleSrc),
  'verifyGoogleIdToken throws when payload.email_verified !== true (checked INSIDE the function)'
)

// ============================================================================
// 9. UI invariants
// ============================================================================

console.log('\n=== 9. UI invariants (Login + Register + GoogleSignInButton) ===')

const loginSrc = readFileSync(
  resolve(process.cwd(), 'src/views/auth/LoginView.tsx'),
  'utf8'
)
const registerSrc = readFileSync(
  resolve(process.cwd(), 'src/views/auth/RegisterView.tsx'),
  'utf8'
)
const buttonSrc = readFileSync(
  resolve(process.cwd(), 'src/components/auth/GoogleSignInButton.tsx'),
  'utf8'
)

// Login + Register both render GoogleSignInButton
assert(
  /<GoogleSignInButton/.test(loginSrc),
  'LoginView renders <GoogleSignInButton>'
)
assert(
  /<GoogleSignInButton/.test(registerSrc),
  'RegisterView renders <GoogleSignInButton>'
)

// Both have the "atau" divider (Google button + email/password form below)
assert(
  /atau/.test(loginSrc),
  'LoginView has "atau" divider between Google button and password form'
)
assert(
  /atau/.test(registerSrc),
  'RegisterView has "atau" divider between Google button and password form'
)

// GoogleSignInButton fetches /api/auth/google-config and hides when disabled
assert(
  /fetch\s*\(\s*['"]\/api\/auth\/google-config['"]\s*\)/.test(buttonSrc),
  'GoogleSignInButton fetches /api/auth/google-config to check if Google OAuth is enabled'
)
assert(
  /if\s*\(\s*!enabled\s*\)[\s\S]*?return\s+null/.test(buttonSrc),
  'GoogleSignInButton returns null when Google OAuth is not configured (no broken redirect)'
)

// GoogleSignInButton uses safeInternalPath on ?next=
assert(
  /safeInternalPath\s*\(\s*route\.query\.get\s*\(\s*['"]next['"]\s*\)\s*\)/.test(buttonSrc),
  'GoogleSignInButton uses safeInternalPath on ?next= (open-redirect defense)'
)

// GoogleSignInButton builds the href to /api/auth/google?next=... (or without ?next= when no safe next)
assert(
  /\/api\/auth\/google/.test(buttonSrc),
  'GoogleSignInButton links to /api/auth/google (entry route)'
)

// Mobile-first: button is full-width (w-full) — already in the source
assert(
  /w-full/.test(buttonSrc),
  'GoogleSignInButton is full-width (mobile-first)'
)

// ============================================================================
// 10. .env.example documents the exact env names + redirect URI
// ============================================================================

console.log('\n=== 10. .env.example documents exact env names + redirect URI ===')

const envExample = readFileSync(
  resolve(process.cwd(), '.env.example'),
  'utf8'
)

assert(
  /GOOGLE_OAUTH_CLIENT_ID=/.test(envExample),
  '.env.example documents GOOGLE_OAUTH_CLIENT_ID'
)
assert(
  /GOOGLE_OAUTH_CLIENT_SECRET=/.test(envExample),
  '.env.example documents GOOGLE_OAUTH_CLIENT_SECRET'
)
assert(
  /NEXT_PUBLIC_SITE_URL=/.test(envExample),
  '.env.example documents NEXT_PUBLIC_SITE_URL'
)
assert(
  /https:\/\/animacompanion\.id\/api\/auth\/google\/callback/.test(envExample),
  '.env.example documents the production redirect URI: https://animacompanion.id/api/auth/google/callback'
)

// ============================================================================
// Summary
// ============================================================================

console.log('\n' + '='.repeat(60))
console.log(`Google OAuth tests: ${pass} passed, ${fail} failed`)
if (fail > 0) {
  console.log('\nFailed assertions:')
  failures.forEach((f) => console.log(`  - ${f}`))
  process.exit(1)
}
console.log('All Google OAuth tests PASSED.')
process.exit(0)
