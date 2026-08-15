/**
 * BrevoEmailAdapter — focused unit tests with mocked fetch.
 *
 * Run with:
 *   bun run scripts/test-email-brevo.ts
 *
 * IMPORTANT:
 *   - This script NEVER sends a real email. `global.fetch` is replaced
 *     with an in-memory mock that records the request and returns a
 *     canned Response. No network access occurs.
 *   - The script aborts immediately if NODE_ENV=production — these
 *     tests construct BrevoEmailAdapter with fake credentials and MUST
 *     NOT run in a production runtime.
 *   - The script restores the original `global.fetch` after each test
 *     case, so unrelated tests are not affected.
 *
 * Coverage matrix:
 *
 *   CONSTRUCTOR
 *     C1. Throws when BREVO_API_KEY is missing/empty.
 *     C2. Throws when EMAIL_FROM is missing/empty.
 *     C3. Does NOT throw when EMAIL_FROM_NAME is missing — defaults to
 *         "Anima Companion".
 *     C4. Does NOT throw when EMAIL_FROM_NAME is empty — defaults to
 *         "Anima Companion".
 *     C5. Reads all three env vars correctly when set.
 *
 *   REQUEST SHAPE (verified via fetch mock argument capture)
 *     R1. POST to https://api.brevo.com/v3/smtp/email
 *     R2. Headers: api-key=<BREVO_API_KEY>, Content-Type=application/json
 *     R3. Body.sender = { name: EMAIL_FROM_NAME, email: EMAIL_FROM }
 *     R4. Body.to = [{ email: message.to }]  (single-element array)
 *     R5. Body.subject = message.subject
 *     R6. Body.textContent = message.text
 *     R7. Body.htmlContent = message.html WHEN message.html is present
 *     R8. Body.htmlContent is OMITTED when message.html is absent
 *         (no `undefined` serialized — JSON.stringify drops it).
 *
 *   RESPONSE HANDLING
 *     S1. 2xx response → resolves, no throw.
 *     S2. 4xx response → throws Error('EMAIL_DELIVERY_FAILED').
 *     S3. 5xx response → throws Error('EMAIL_DELIVERY_FAILED').
 *     S4. Network failure (fetch rejects) → throws Error('EMAIL_DELIVERY_FAILED').
 *
 *   SECURITY / SANITIZATION
 *     SEC1. Thrown error message on 4xx/5xx does NOT contain:
 *           - the raw Brevo response body
 *           - the BREVO_API_KEY
 *           - the email body / OTP / verification token
 *     SEC2. Thrown error message on network failure does NOT contain:
 *           - the host / port / DNS error string
 *           - the BREVO_API_KEY
 *     SEC3. The fetch mock's `headers['api-key']` matches BREVO_API_KEY
 *          exactly (no accidental prefix/suffix/wrapping).
 *     SEC4. BrevoEmailAdapter.send does NOT call console.log/error/warn
 *          (raw email body / OTP / URL never logged) — source-level.
 *     SEC5. The fetch mock's recorded body JSON does NOT include the
 *          BREVO_API_KEY (the key lives only in the header, never in
 *          the request body).
 *
 *   FACTORY INTEGRATION
 *     F1. EMAIL_PROVIDER=brevo + BREVO_API_KEY + EMAIL_FROM + EMAIL_FROM_NAME
 *         → getEmailAdapter() returns a BrevoEmailAdapter instance.
 *     F2. EMAIL_PROVIDER=brevo + BREVO_API_KEY missing → getEmailAdapter()
 *         throws (no silent fallback to DevConsoleEmailAdapter).
 *
 * Run all tests, print human-readable PASS/FAIL per scenario, exit 0/1.
 */
// ----- Safety guards -----
if (process.env.NODE_ENV === 'production') {
  console.error('REFUSING TO RUN: NODE_ENV is "production".')
  console.error('This script constructs BrevoEmailAdapter with fake credentials; never run against production.')
  process.exit(2)
}

import { BrevoEmailAdapter, getEmailAdapter, type EmailMessage } from '../src/lib/email'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ---------------------------------------------------------------------------
// Tiny test harness — mirrors the pattern in scripts/test-verified-identity.ts.
// ---------------------------------------------------------------------------
let pass = 0
let fail = 0
const failures: string[] = []

function assert(cond: boolean, message: string): void {
  if (cond) {
    pass++
    console.log(`  ✅ ${message}`)
  } else {
    fail++
    failures.push(message)
    console.log(`  ❌ ${message}`)
  }
}

function assertThrows(predicate: (e: unknown) => boolean, fn: () => unknown, message: string): void {
  let threw = false
  let caught: unknown = null
  try {
    fn()
  } catch (e) {
    threw = true
    caught = e
  }
  assert(threw && predicate(caught), message)
}

// ---------------------------------------------------------------------------
// Fetch mock — records the most recent request and returns a canned Response.
// ---------------------------------------------------------------------------
interface RecordedRequest {
  url: string
  method: string
  headers: Record<string, string>
  body: string
}

interface MockFetchOptions {
  status?: number
  statusText?: string
  bodyText?: string
  // If provided, fetch() will REJECT with this error (simulates network
  // failure). Mutually exclusive with status/bodyText.
  networkError?: Error
}

let recordedRequest: RecordedRequest | null = null
let originalFetch: typeof global.fetch | null = null

function installMockFetch(opts: MockFetchOptions = {}): void {
  if (originalFetch) {
    // Already installed — caller forgot to restore. Restore first to
    // avoid stacking mocks.
    restoreMockFetch()
  }
  originalFetch = global.fetch
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const method = (init?.method || 'GET').toUpperCase()
    const headers: Record<string, string> = {}
    if (init?.headers) {
      const h = init.headers
      if (h instanceof Headers) {
        h.forEach((v, k) => { headers[k] = v })
      } else if (Array.isArray(h)) {
        for (const [k, v] of h) headers[k] = v
      } else {
        for (const [k, v] of Object.entries(h)) headers[k] = v
      }
    }
    const body = init?.body ? (typeof init.body === 'string' ? init.body : '') : ''
    recordedRequest = { url, method, headers, body }
    if (opts.networkError) {
      throw opts.networkError
    }
    const status = opts.status ?? 201
    const statusText = opts.statusText ?? 'Created'
    const bodyText = opts.bodyText ?? ''
    return new Response(bodyText, { status, statusText, headers: { 'Content-Type': 'application/json' } })
  }) as typeof global.fetch
}

function restoreMockFetch(): void {
  if (originalFetch) {
    global.fetch = originalFetch
    originalFetch = null
  }
  recordedRequest = null
}

// ---------------------------------------------------------------------------
// Env helper — snapshot, mutate, restore. Each test gets a clean env.
// ---------------------------------------------------------------------------
const ENV_KEYS = ['BREVO_API_KEY', 'EMAIL_FROM', 'EMAIL_FROM_NAME', 'EMAIL_PROVIDER'] as const
const envSnapshot: Record<string, string | undefined> = {}
for (const k of ENV_KEYS) envSnapshot[k] = process.env[k]

function setEnv(values: Partial<Record<typeof ENV_KEYS[number], string>>): void {
  for (const k of ENV_KEYS) {
    if (k in values) {
      process.env[k] = values[k]
    } else {
      delete process.env[k]
    }
  }
}

function restoreEnv(): void {
  for (const k of ENV_KEYS) {
    if (envSnapshot[k] === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = envSnapshot[k]
    }
  }
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------
async function runConstructorTests(): Promise<void> {
  console.log('\n── CONSTRUCTOR ──')

  // C1. Throws when BREVO_API_KEY is missing/empty.
  console.log('\n[C1] Throws when BREVO_API_KEY is missing/empty')
  setEnv({ EMAIL_FROM: 'noreply@animacompanion.id', EMAIL_FROM_NAME: 'Anima Companion' })
  assertThrows(
    (e) => e instanceof Error && /BREVO_API_KEY\s+is\s+not\s+set/.test(e.message),
    () => new BrevoEmailAdapter(),
    'C1a: throws when BREVO_API_KEY is missing'
  )
  setEnv({ BREVO_API_KEY: '   ', EMAIL_FROM: 'noreply@animacompanion.id', EMAIL_FROM_NAME: 'Anima Companion' })
  assertThrows(
    (e) => e instanceof Error && /BREVO_API_KEY\s+is\s+not\s+set/.test(e.message),
    () => new BrevoEmailAdapter(),
    'C1b: throws when BREVO_API_KEY is whitespace-only'
  )

  // C2. Throws when EMAIL_FROM is missing/empty.
  console.log('\n[C2] Throws when EMAIL_FROM is missing/empty')
  setEnv({ BREVO_API_KEY: 'test-key', EMAIL_FROM_NAME: 'Anima Companion' })
  assertThrows(
    (e) => e instanceof Error && /EMAIL_FROM\s+is\s+not\s+set/.test(e.message),
    () => new BrevoEmailAdapter(),
    'C2a: throws when EMAIL_FROM is missing'
  )
  setEnv({ BREVO_API_KEY: 'test-key', EMAIL_FROM: '   ', EMAIL_FROM_NAME: 'Anima Companion' })
  assertThrows(
    (e) => e instanceof Error && /EMAIL_FROM\s+is\s+not\s+set/.test(e.message),
    () => new BrevoEmailAdapter(),
    'C2b: throws when EMAIL_FROM is whitespace-only'
  )

  // C3. Does NOT throw when EMAIL_FROM_NAME is missing — defaults to brand.
  console.log('\n[C3] Does NOT throw when EMAIL_FROM_NAME is missing (defaults to "Anima Companion")')
  setEnv({ BREVO_API_KEY: 'test-key', EMAIL_FROM: 'noreply@animacompanion.id' })
  let adapterC3: BrevoEmailAdapter | null = null
  try {
    adapterC3 = new BrevoEmailAdapter()
  } catch (e) {
    adapterC3 = null
  }
  assert(adapterC3 !== null, 'C3: constructor does not throw when EMAIL_FROM_NAME is missing')

  // C4. Does NOT throw when EMAIL_FROM_NAME is empty — defaults to brand.
  console.log('\n[C4] Does NOT throw when EMAIL_FROM_NAME is whitespace (defaults to "Anima Companion")')
  setEnv({ BREVO_API_KEY: 'test-key', EMAIL_FROM: 'noreply@animacompanion.id', EMAIL_FROM_NAME: '   ' })
  let adapterC4: BrevoEmailAdapter | null = null
  try {
    adapterC4 = new BrevoEmailAdapter()
  } catch (e) {
    adapterC4 = null
  }
  assert(adapterC4 !== null, 'C4: constructor does not throw when EMAIL_FROM_NAME is whitespace')

  // C5. Reads all three env vars correctly when set — proven indirectly via
  // the request-shape tests below (R2 + R3).
  console.log('\n[C5] Reads all three env vars correctly (verified via R2/R3 below)')
  setEnv({ BREVO_API_KEY: 'test-key-123', EMAIL_FROM: 'noreply@animacompanion.id', EMAIL_FROM_NAME: 'Anima Companion' })
  let adapterC5: BrevoEmailAdapter | null = null
  try {
    adapterC5 = new BrevoEmailAdapter()
  } catch {
    adapterC5 = null
  }
  assert(adapterC5 !== null, 'C5: constructor succeeds when all three env vars are set')
}

async function runRequestShapeTests(): Promise<void> {
  console.log('\n── REQUEST SHAPE (via fetch mock capture) ──')

  setEnv({ BREVO_API_KEY: 'test-key-123', EMAIL_FROM: 'noreply@animacompanion.id', EMAIL_FROM_NAME: 'Anima Companion' })
  const adapter = new BrevoEmailAdapter()

  // R1+R2+R3+R4+R5+R6+R7 — happy path with HTML body.
  console.log('\n[R1-R7] POST to Brevo endpoint with correct shape (with html)')
  installMockFetch({ status: 201, bodyText: '{"messageId":"test"}' })
  const msgWithHtml: EmailMessage = {
    to: 'user@example.com',
    subject: 'Kode verifikasi email Anda — 123456',
    text: 'Your code is 123456',
    html: '<p>Your code is <b>123456</b></p>',
  }
  await adapter.send(msgWithHtml)
  assert(recordedRequest !== null, 'R1: fetch was called')
  if (recordedRequest) {
    assert(recordedRequest.url === 'https://api.brevo.com/v3/smtp/email', `R1: POST URL is correct (got ${recordedRequest.url})`)
    assert(recordedRequest.method === 'POST', `R2: method is POST (got ${recordedRequest.method})`)
    assert(recordedRequest.headers['api-key'] === 'test-key-123', 'R2: api-key header matches BREVO_API_KEY')
    assert(recordedRequest.headers['Content-Type'] === 'application/json', 'R2: Content-Type is application/json')
    const parsed = JSON.parse(recordedRequest.body) as Record<string, unknown>
    const sender = parsed.sender as Record<string, string>
    assert(sender.name === 'Anima Companion', `R3: body.sender.name = EMAIL_FROM_NAME (got "${sender.name}")`)
    assert(sender.email === 'noreply@animacompanion.id', `R3: body.sender.email = EMAIL_FROM (got "${sender.email}")`)
    const toArr = parsed.to as Array<Record<string, string>>
    assert(Array.isArray(toArr) && toArr.length === 1, 'R4: body.to is a single-element array')
    assert(toArr[0].email === 'user@example.com', `R4: body.to[0].email = message.to (got "${toArr[0].email}")`)
    assert(parsed.subject === msgWithHtml.subject, 'R5: body.subject = message.subject')
    assert(parsed.textContent === msgWithHtml.text, 'R6: body.textContent = message.text')
    assert(parsed.htmlContent === msgWithHtml.html, 'R7: body.htmlContent = message.html when present')
  }
  restoreMockFetch()

  // R8 — htmlContent omitted when message.html is absent.
  console.log('\n[R8] htmlContent is omitted when message.html is absent')
  installMockFetch({ status: 201, bodyText: '{"messageId":"test"}' })
  const msgTextOnly: EmailMessage = {
    to: 'user@example.com',
    subject: 'Kode verifikasi email Anda — 123456',
    text: 'Your code is 123456',
  }
  await adapter.send(msgTextOnly)
  if (recordedRequest) {
    const parsed = JSON.parse(recordedRequest.body) as Record<string, unknown>
    assert(!('htmlContent' in parsed), 'R8: htmlContent key is NOT present when message.html is absent')
    assert(parsed.textContent === msgTextOnly.text, 'R8: textContent still present')
  } else {
    assert(false, 'R8: fetch was called')
  }
  restoreMockFetch()
}

async function runResponseHandlingTests(): Promise<void> {
  console.log('\n── RESPONSE HANDLING ──')

  setEnv({ BREVO_API_KEY: 'test-key-123', EMAIL_FROM: 'noreply@animacompanion.id', EMAIL_FROM_NAME: 'Anima Companion' })
  const adapter = new BrevoEmailAdapter()
  const msg: EmailMessage = { to: 'user@example.com', subject: 'Test', text: 'Body' }

  // S1. 2xx response → resolves, no throw.
  console.log('\n[S1] 2xx response → resolves, no throw')
  installMockFetch({ status: 201, bodyText: '{"messageId":"abc"}' })
  let s1Threw = false
  try {
    await adapter.send(msg)
  } catch {
    s1Threw = true
  }
  assert(!s1Threw, 'S1: 2xx response does not throw')
  restoreMockFetch()

  // S2. 4xx response → throws EMAIL_DELIVERY_FAILED.
  console.log('\n[S2] 4xx response → throws Error("EMAIL_DELIVERY_FAILED")')
  installMockFetch({ status: 400, statusText: 'Bad Request', bodyText: '{"code":"invalid_request","message":"sender not allowed"}' })
  let s2Err: unknown = null
  try {
    await adapter.send(msg)
  } catch (e) {
    s2Err = e
  }
  assert(
    s2Err instanceof Error && s2Err.message === 'EMAIL_DELIVERY_FAILED',
    `S2: 4xx throws Error("EMAIL_DELIVERY_FAILED") (got ${s2Err instanceof Error ? s2Err.message : String(s2Err)})`
  )
  restoreMockFetch()

  // S3. 5xx response → throws EMAIL_DELIVERY_FAILED.
  console.log('\n[S3] 5xx response → throws Error("EMAIL_DELIVERY_FAILED")')
  installMockFetch({ status: 500, statusText: 'Internal Server Error', bodyText: '{"code":"internal_error"}' })
  let s3Err: unknown = null
  try {
    await adapter.send(msg)
  } catch (e) {
    s3Err = e
  }
  assert(
    s3Err instanceof Error && s3Err.message === 'EMAIL_DELIVERY_FAILED',
    `S3: 5xx throws Error("EMAIL_DELIVERY_FAILED") (got ${s3Err instanceof Error ? s3Err.message : String(s3Err)})`
  )
  restoreMockFetch()

  // S4. Network failure → throws EMAIL_DELIVERY_FAILED.
  console.log('\n[S4] Network failure (fetch rejects) → throws Error("EMAIL_DELIVERY_FAILED")')
  installMockFetch({ networkError: new Error('getaddrinfo ENOTFOUND api.brevo.com 443') })
  let s4Err: unknown = null
  try {
    await adapter.send(msg)
  } catch (e) {
    s4Err = e
  }
  assert(
    s4Err instanceof Error && s4Err.message === 'EMAIL_DELIVERY_FAILED',
    `S4: network failure throws Error("EMAIL_DELIVERY_FAILED") (got ${s4Err instanceof Error ? s4Err.message : String(s4Err)})`
  )
  restoreMockFetch()
}

async function runSecurityTests(): Promise<void> {
  console.log('\n── SECURITY / SANITIZATION ──')

  setEnv({ BREVO_API_KEY: 'SECRET-KEY-DO-NOT-LEAK', EMAIL_FROM: 'noreply@animacompanion.id', EMAIL_FROM_NAME: 'Anima Companion' })
  const adapter = new BrevoEmailAdapter()
  const msg: EmailMessage = {
    to: 'user@example.com',
    subject: 'Kode verifikasi email Anda — 654321',
    text: 'Your single-use OTP is 654321. Do not share it.',
  }

  // SEC1. 4xx thrown error message does NOT contain Brevo body, key, or OTP.
  console.log('\n[SEC1] 4xx thrown error message is sanitized (no body / key / OTP)')
  installMockFetch({
    status: 400,
    bodyText: '{"code":"invalid_request","message":"sender noreply@animacompanion.id not verified"}',
  })
  let sec1Err: unknown = null
  try {
    await adapter.send(msg)
  } catch (e) {
    sec1Err = e
  }
  if (sec1Err instanceof Error) {
    const m = sec1Err.message
    assert(!m.includes('SECRET-KEY-DO-NOT-LEAK'), 'SEC1a: thrown error does NOT contain BREVO_API_KEY')
    assert(!m.includes('not verified'), 'SEC1b: thrown error does NOT contain raw Brevo response body')
    assert(!m.includes('654321'), 'SEC1c: thrown error does NOT contain OTP / email body')
    assert(!m.includes('user@example.com'), 'SEC1d: thrown error does NOT contain recipient email')
  } else {
    assert(false, 'SEC1: thrown value is an Error instance')
  }
  restoreMockFetch()

  // SEC2. Network failure thrown error message is sanitized.
  console.log('\n[SEC2] Network failure thrown error message is sanitized (no host / key)')
  installMockFetch({ networkError: new Error('getaddrinfo ENOTFOUND api.brevo.com 443') })
  let sec2Err: unknown = null
  try {
    await adapter.send(msg)
  } catch (e) {
    sec2Err = e
  }
  if (sec2Err instanceof Error) {
    const m = sec2Err.message
    assert(!m.includes('SECRET-KEY-DO-NOT-LEAK'), 'SEC2a: thrown error does NOT contain BREVO_API_KEY')
    assert(!m.includes('api.brevo.com'), 'SEC2b: thrown error does NOT contain Brevo host')
    assert(!m.includes('ENOTFOUND'), 'SEC2c: thrown error does NOT contain DNS error string')
  } else {
    assert(false, 'SEC2: thrown value is an Error instance')
  }
  restoreMockFetch()

  // SEC3. The api-key header matches BREVO_API_KEY exactly.
  console.log('\n[SEC3] api-key header matches BREVO_API_KEY exactly (no prefix/suffix)')
  installMockFetch({ status: 201, bodyText: '{}' })
  await adapter.send(msg)
  if (recordedRequest) {
    assert(
      recordedRequest.headers['api-key'] === 'SECRET-KEY-DO-NOT-LEAK',
      `SEC3: api-key header is exactly BREVO_API_KEY (got "${recordedRequest.headers['api-key']}")`
    )
  } else {
    assert(false, 'SEC3: fetch was called')
  }
  restoreMockFetch()

  // SEC4. Source-level: BrevoEmailAdapter.send does NOT call console.* with
  // the raw email body / OTP / URL. We parse the file's source and assert
  // the send() method body has zero console.log/error/warn calls (comments
  // are stripped before the check, same pattern as SRC118 in
  // scripts/test-otp-domain.ts for ResendEmailAdapter).
  console.log('\n[SEC4] BrevoEmailAdapter.send does NOT call console.* (source-level)')
  const emailSrc = readFileSync(resolve(process.cwd(), 'src/lib/email.ts'), 'utf8')
  const brevoSendMatch = emailSrc.match(/class\s+BrevoEmailAdapter[\s\S]*?async\s+send[\s\S]*?\n  \}/)
  if (brevoSendMatch) {
    const stripped = brevoSendMatch[0].replace(/\/\/[^\n]*/g, '')
    assert(
      !/console\.(log|error|warn)\s*\(/.test(stripped),
      'SEC4: BrevoEmailAdapter.send does NOT call console.log/error/warn'
    )
  } else {
    assert(false, 'SEC4: BrevoEmailAdapter.send method found in source')
  }

  // SEC5. The recorded request body JSON does NOT include the BREVO_API_KEY.
  console.log('\n[SEC5] Request body JSON does NOT include BREVO_API_KEY (key lives only in header)')
  installMockFetch({ status: 201, bodyText: '{}' })
  await adapter.send(msg)
  if (recordedRequest) {
    const bodyStr = recordedRequest.body
    assert(
      !bodyStr.includes('SECRET-KEY-DO-NOT-LEAK'),
      'SEC5: BREVO_API_KEY is NOT serialized into the request body'
    )
  } else {
    assert(false, 'SEC5: fetch was called')
  }
  restoreMockFetch()
}

async function runFactoryIntegrationTests(): Promise<void> {
  console.log('\n── FACTORY INTEGRATION ──')

  // F1. EMAIL_PROVIDER=brevo + full env → getEmailAdapter() returns BrevoEmailAdapter.
  console.log('\n[F1] EMAIL_PROVIDER=brevo + full env → getEmailAdapter() returns BrevoEmailAdapter')
  setEnv({
    EMAIL_PROVIDER: 'brevo',
    BREVO_API_KEY: 'factory-test-key',
    EMAIL_FROM: 'noreply@animacompanion.id',
    EMAIL_FROM_NAME: 'Anima Companion',
  })
  // The factory caches the adapter in module scope. Since this is the first
  // call in this process, the cache is empty — no need to reset.
  // NOTE: __setEmailAdapterForTesting(null) would reset the cache, but that
  // function throws in production. We're not in production here, so it's
  // safe to import + call if needed. For the first call, the cache is null.
  const adapter = getEmailAdapter()
  assert(adapter instanceof BrevoEmailAdapter, 'F1: getEmailAdapter() returns BrevoEmailAdapter')
  // Reset the cache so subsequent runs of this script start fresh.
  const { __setEmailAdapterForTesting } = await import('../src/lib/email')
  __setEmailAdapterForTesting(null)

  // F2. EMAIL_PROVIDER=brevo + BREVO_API_KEY missing → getEmailAdapter() throws.
  console.log('\n[F2] EMAIL_PROVIDER=brevo + BREVO_API_KEY missing → getEmailAdapter() throws')
  setEnv({
    EMAIL_PROVIDER: 'brevo',
    EMAIL_FROM: 'noreply@animacompanion.id',
    EMAIL_FROM_NAME: 'Anima Companion',
  })
  // Cache was reset above — factory will try to construct BrevoEmailAdapter.
  assertThrows(
    (e) => e instanceof Error && /BREVO_API_KEY\s+is\s+not\s+set/.test(e.message),
    () => getEmailAdapter(),
    'F2: getEmailAdapter() throws when BREVO_API_KEY is missing'
  )
  // Reset cache again so the failed construction doesn't poison it.
  __setEmailAdapterForTesting(null)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('========================================')
  console.log('BrevoEmailAdapter — focused unit tests')
  console.log('(all fetch calls are mocked; no network)')
  console.log('========================================')

  try {
    await runConstructorTests()
    await runRequestShapeTests()
    await runResponseHandlingTests()
    await runSecurityTests()
    await runFactoryIntegrationTests()
  } finally {
    // Always restore env + fetch, even on assertion failure.
    restoreEnv()
    restoreMockFetch()
  }

  console.log('\n────────────────────────────────────────')
  console.log(`BrevoEmailAdapter tests: ${pass} passed, ${fail} failed`)
  if (fail > 0) {
    console.log('\nFailures:')
    failures.forEach((f) => console.log(`  - ${f}`))
    process.exit(1)
  }
  console.log('All BrevoEmailAdapter tests passed.')
  process.exit(0)
}

main().catch((e) => {
  console.error('BrevoEmailAdapter test harness crashed:', e)
  restoreEnv()
  restoreMockFetch()
  process.exit(1)
})
