/**
 * Toast Standardization Audit V1 — test scenarios.
 *
 * Run with:
 *   # Pure static tests (always run):
 *   bun run scripts/test-toast.ts
 *
 *   # Full HTTP integration tests (requires a running server):
 *   BASE_URL="http://localhost:3000" bun run scripts/test-toast.ts
 *
 * IMPORTANT:
 * - This script does NOT mutate the database in static mode. It only verifies
 *   the Sonner surface, layout mounting, dead-Radix removal, and source-level
 *   invariants for every toast call site.
 * - In HTTP mode (BASE_URL set), the script exercises the login success and
 *   error paths plus a few admin/checkout flows that we know fire toasts.
 *   It uses temporary QA users registered via /api/auth/register and cleans
 *   them up at the end. NEVER run this against a production deployment.
 * - The script aborts immediately if NODE_ENV=production.
 * - All assertions are static (no test framework). Output is human-readable.
 *   Exit code is 0 if all scenarios pass, 1 otherwise.
 *
 * Scenarios covered:
 *
 * Pure-static (always run):
 *   S1.  sonner package exposes toast.{success,error,info,warning,loading,promise,custom,dismiss,message}
 *   S2.  sonner package exposes Toaster component
 *   S3.  src/components/ui/sonner.tsx re-exports Toaster
 *   S4.  src/components/ui/sonner.tsx sets sensible defaults (position, richColors, closeButton)
 *   S5.  layout.tsx imports Toaster from "@/components/ui/sonner" and renders <Toaster />
 *   S6.  Dead Radix files no longer exist (toast.tsx, toaster.tsx, use-toast.ts)
 *   S7.  No remaining imports of @radix-ui/react-toast or @/hooks/use-toast
 *   S8.  package.json no longer lists @radix-ui/react-toast as a dependency
 *   S9.  next.config.ts no longer lists @radix-ui/react-toast in optimizePackageImports
 *   S10. LoginView source: error toast on empty form + error toast on API failure + success toast on ok
 *   S11. CheckoutView source: toast.error on incomplete form + toast.success on order + toast.error on 401/409/400/fallback
 *   S12. Admin views source: every toast.* call uses a valid Sonner signature
 *   S13. All 21 caller files import { toast } from 'sonner' (no alias mismatch)
 *
 * HTTP integration (requires BASE_URL):
 *   H1. login with empty body → 400 (matches LoginView's empty-form toast.error branch)
 *   H2. login with wrong password → 401 (matches LoginView's toast.error branch)
 *   H3. login with valid customer creds → 200 + Set-Cookie + user.name (matches LoginView's toast.success branch)
 *   H4. GET /api/admin/orders without auth → 401 (admin auth gate; matches OrdersView toast.error pre-flight)
 *   H5. GET /api/admin/orders with customer session → 403 (admin auth gate, role escalation)
 *   H6. GET /api/admin/orders with admin session → 200 (admin auth gate)
 *   H7. POST /api/orders without auth → 401 (checkout auth gate)
 *   H8. POST /api/orders with auth but empty items → 400 (matches CheckoutView toast.error fallback)
 *   H9. POST /api/auth/logout with valid session → 200 (clears session cookie)
 */

// ----- Safety guards -----
if (process.env.NODE_ENV === 'production') {
  console.error('REFUSING TO RUN: NODE_ENV is "production".')
  console.error('This script may register temporary QA users; never run against production.')
  process.exit(2)
}

import { readFileSync, existsSync, statSync } from 'fs'
import { resolve, join } from 'path'
import * as sonner from 'sonner'
import { walkSrc } from './_walk-src'

const ROOT = process.cwd()
const SRC = (p: string) => join(ROOT, 'src', p)
const PKG = (p: string) => join(ROOT, p)
const SCRIPTS = (p: string) => join(ROOT, 'scripts', p)

const BASE_URL = process.env.BASE_URL || ''
const HTTP_MODE = BASE_URL.length > 0

let pass = 0
let fail = 0
const failures: string[] = []

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`)
    pass++
  } else {
    console.log(`  ❌ ${message}`)
    fail++
    failures.push(message)
  }
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  assert(ok, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

function readFileSafe(p: string): string {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}

function fileMissing(p: string): boolean {
  try {
    return !existsSync(p)
  } catch {
    return true
  }
}

// ============================================================================
// Pure-static tests — always run, no DB, no HTTP
// ============================================================================

function testSonnerSurface() {
  console.log('\n========================================')
  console.log('Sonner surface — package exports')
  console.log('========================================')

  console.log('\n[S1] sonner exposes toast.{success,error,info,warning,loading,promise,custom,dismiss,message}')
  const t = (sonner as any).toast
  assert(typeof t === 'function', 'toast default export is a function')
  for (const method of ['success', 'error', 'info', 'warning', 'loading', 'promise', 'custom', 'dismiss', 'message'] as const) {
    assert(typeof t?.[method] === 'function', `toast.${method} is a function`)
  }

  console.log('\n[S2] sonner exposes Toaster component')
  assert(typeof (sonner as any).Toaster === 'function' || typeof (sonner as any).Toaster === 'object',
    'sonner.Toaster is exported (function/object)')
}

function testSonnerComponent() {
  console.log('\n========================================')
  console.log('Sonner Toaster wrapper — src/components/ui/sonner.tsx')
  console.log('========================================')

  const src = readFileSafe(SRC('components/ui/sonner.tsx'))
  assert(src.length > 0, 'src/components/ui/sonner.tsx exists and is non-empty')

  console.log('\n[S3] Re-exports Toaster')
  assert(/export\s*\{\s*Toaster\s*\}/.test(src), 're-exports { Toaster }')
  assert(/from\s+["']sonner["']/.test(src), 'imports from "sonner"')

  console.log('\n[S4] Sensible defaults configured')
  assert(/position=/.test(src), 'sets position')
  assert(/richColors/.test(src), 'enables richColors')
  assert(/closeButton/.test(src), 'enables closeButton')
  assert(/duration=/.test(src), 'sets duration')
  assert(/useTheme\(\)/.test(src), 'uses next-themes useTheme for theme sync')
  // Sonner pauses auto-dismiss on hover by default — we keep a code comment
  // documenting this so future contributors don't try to re-add a
  // non-existent `pauseOnHover` prop.
  assert(/hover/i.test(src), 'documents hover-to-pause default behavior')
}

function testLayoutMounting() {
  console.log('\n========================================')
  console.log('Layout mounting — src/app/layout.tsx')
  console.log('========================================')

  const layout = readFileSafe(SRC('app/layout.tsx'))
  assert(layout.length > 0, 'src/app/layout.tsx exists and is non-empty')

  console.log('\n[S5] Imports Toaster from "@/components/ui/sonner" and renders <Toaster />')
  assert(/import\s*\{\s*Toaster\s*\}\s*from\s+["']@\/components\/ui\/sonner["']/.test(layout),
    'imports { Toaster } from "@/components/ui/sonner"')
  assert(!/["']@\/components\/ui\/toaster["']/.test(layout),
    'does NOT import from "@/components/ui/toaster"')
  assert(/<Toaster\s*\/>/.test(layout), 'renders <Toaster /> in body')
}

function testDeadRadixRemoval() {
  console.log('\n========================================')
  console.log('Dead Radix toast files — removal verification')
  console.log('========================================')

  console.log('\n[S6] Dead Radix files no longer exist')
  assert(fileMissing(SRC('components/ui/toast.tsx')), 'src/components/ui/toast.tsx deleted')
  assert(fileMissing(SRC('components/ui/toaster.tsx')), 'src/components/ui/toaster.tsx deleted')
  assert(fileMissing(SRC('hooks/use-toast.ts')), 'src/hooks/use-toast.ts deleted')

  console.log('\n[S7] No remaining imports of @radix-ui/react-toast or @/hooks/use-toast')
  // Walk all src .ts/.tsx files and check for forbidden import specifiers.
  const files = walkSrc()
  const forbidden = [
    '@/components/ui/toaster',
    '@/components/ui/toast',
    '@/hooks/use-toast',
    '@radix-ui/react-toast',
  ]
  const hits: { file: string; spec: string }[] = []
  for (const f of files) {
    const content = readFileSafe(f)
    for (const spec of forbidden) {
      // Match import statements only, ignore doc comments. The sonner.tsx
      // file has a doc-comment listing the forbidden modules — that's fine.
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Skip lines that are inside block comments or are clearly comments.
        if (line.trim().startsWith('*') || line.trim().startsWith('//')) continue
        // Match import statements.
        if (/^\s*import\s/.test(line) && line.includes(spec)) {
          hits.push({ file: f.replace(ROOT + '/', ''), spec })
        }
      }
    }
  }
  assert(hits.length === 0,
    hits.length === 0
      ? 'no forbidden Radix/toast imports anywhere in src/'
      : `forbidden imports found: ${hits.map(h => `${h.file} → ${h.spec}`).join(', ')}`)

  console.log('\n[S8] package.json no longer lists @radix-ui/react-toast')
  const pkg = JSON.parse(readFileSafe(PKG('package.json')))
  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
  assert(!('@radix-ui/react-toast' in allDeps), '@radix-ui/react-toast removed from dependencies')

  console.log('\n[S9] next.config.ts no longer lists @radix-ui/react-toast in optimizePackageImports')
  const nextCfg = readFileSafe(PKG('next.config.ts'))
  assert(!/@radix-ui\/react-toast/.test(nextCfg),
    'next.config.ts no longer references @radix-ui/react-toast')
}

function testCallSiteSignatures() {
  console.log('\n========================================')
  console.log('Call-site signatures — Sonner API conformance')
  console.log('========================================')

  const files = walkSrc()

  // S10 — LoginView contract (LoginView.tsx).
  console.log('\n[S10] LoginView fires toast.error (empty + failure) and toast.success (welcome)')
  const login = readFileSafe(SRC('views/auth/LoginView.tsx'))
  assert(/from\s+["']sonner["']/.test(login), 'LoginView imports { toast } from "sonner"')
  assert(/toast\.error\(["'`]Email dan password wajib diisi["'`]\)/.test(login),
    'empty-form toast.error present')
  assert(/toast\.success\(`Selamat datang, \$\{data\.user\.name\}!`\)/.test(login),
    'success toast uses data.user.name')
  assert(/toast\.error\(e\.message \|\| ["'`]Gagal masuk["'`]\)/.test(login),
    'fallback toast.error uses e.message')

  // S11 — CheckoutView contract (CheckoutView.tsx).
  console.log('\n[S11] CheckoutView fires toast.error for incomplete/401/409/400/fallback and toast.success on order')
  const checkout = readFileSafe(SRC('views/CheckoutView.tsx'))
  assert(/from\s+["']sonner["']/.test(checkout), 'CheckoutView imports { toast } from "sonner"')
  assert(/toast\.error\(["'`]Lengkapi data pengiriman terlebih dahulu["'`]\)/.test(checkout),
    'incomplete-form toast.error present')
  assert(/toast\.error\(["'`]Sesi login berakhir\. Silakan masuk kembali\.["'`]\)/.test(checkout),
    '401 toast.error present (session expired)')
  assert(/res\.status\s*===\s*409/.test(checkout) && /toast\.error\(data\.error \|\|/.test(checkout),
    '409 (out of stock) toast.error present')
  assert(/res\.status\s*===\s*400/.test(checkout) && /toast\.error\(data\.error \|\|/.test(checkout),
    '400 (invalid product) toast.error present')
  assert(/toast\.success\(`Pesanan \$\{data\.order\.orderNumber\} dibuat! Mengarahkan ke WhatsApp\.\.\.`\)/.test(checkout),
    'order success toast uses order number')
  assert(/toast\.error\(e\.message \|\| ["'`]Gagal membuat pesanan["'`]\)/.test(checkout),
    'fallback toast.error uses e.message')

  // S12 — Admin views use valid Sonner signatures (no Radix-style toast({...})).
  console.log('\n[S12] All toast calls use Sonner signature — no Radix-style toast({...})')
  const adminViewFiles = files.filter(f => f.includes('/views/admin/') && f.endsWith('.tsx'))
  let radixStyleHits = 0
  for (const f of adminViewFiles) {
    const content = readFileSafe(f)
    // Radix style: toast({ title: ... }) — matches the old use-toast.ts API.
    if (/toast\(\s*\{[^}]*title/.test(content)) {
      radixStyleHits++
      console.log(`  ⚠️  ${f.replace(ROOT + '/', '')} — found Radix-style toast({ title: ... })`)
    }
    // Every admin view that uses toast should import from 'sonner'.
    if (/toast\./.test(content) && !/from\s+["']sonner["']/.test(content)) {
      radixStyleHits++
      console.log(`  ⚠️  ${f.replace(ROOT + '/', '')} — uses toast but does not import from 'sonner'`)
    }
  }
  assert(radixStyleHits === 0,
    radixStyleHits === 0
      ? `all ${adminViewFiles.length} admin views use Sonner signature`
      : `${radixStyleHits} invalid call sites in admin views`)

  // S13 — All 21 caller files import { toast } from 'sonner'.
  console.log('\n[S13] Every file that calls toast.* imports { toast } from "sonner"')
  const callers = files.filter(f => {
    const c = readFileSafe(f)
    return /\btoast\.(success|error|info|warning|loading|promise|custom|dismiss|message)\s*\(/.test(c)
  })
  const missingImports = callers.filter(f => {
    const c = readFileSafe(f)
    return !/from\s+["']sonner["']/.test(c)
  })
  assert(callers.length > 0, `found ${callers.length} files calling toast.*`)
  assert(missingImports.length === 0,
    missingImports.length === 0
      ? 'all callers import { toast } from "sonner"'
      : `callers missing sonner import: ${missingImports.map(f => f.replace(ROOT + '/', '')).join(', ')}`)
}

// ============================================================================
// HTTP integration tests — require BASE_URL (a running dev server)
// ============================================================================

async function httpLogin(email: string, password: string): Promise<{ res: any; body: any; cookies: string[] }> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await res.json().catch(() => ({}))
  // Bun's Headers.get('set-cookie') returns a single string with comma-joined cookies.
  // We re-split by `, ` only when followed by a key= pattern.
  const setCookie = res.headers.get('set-cookie') || ''
  const cookies = setCookie.split(/,\s*(?=[A-Za-z0-9_-]+=)/).filter(Boolean)
  return { res, body, cookies }
}

async function httpGetWithCookie(path: string, cookieHeader: string): Promise<{ res: any; body: any }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: { Cookie: cookieHeader },
  })
  const body = await res.json().catch(() => ({}))
  return { res, body }
}

async function httpPostWithCookie(path: string, cookieHeader: string, payload: any): Promise<{ res: any; body: any }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  return { res, body }
}

function cookieFrom(cookies: string[]): string {
  // Only return the name=value pair (strip attributes like HttpOnly, Path, etc.)
  return cookies
    .map(c => c.split(';')[0])
    .filter(c => c.length > 0)
    .join('; ')
}

async function testHttpLoginFlow() {
  console.log('\n========================================')
  console.log('HTTP — login success/error toast paths')
  console.log('========================================')

  console.log('\n[H1] login with empty body → 400 (LoginView empty-form branch)')
  {
    const { res } = await httpLogin('', '')
    assert(res.status === 400, `expected 400, got ${res.status}`)
  }

  console.log('\n[H2] login with wrong password → 401 (LoginView failure branch)')
  {
    const { res, body } = await httpLogin('budi@example.com', 'wrong-password-xyz')
    assert(res.status === 401, `expected 401, got ${res.status}`)
    assert(!!body.error, 'response includes error message')
  }

  console.log('\n[H3] login with valid customer creds → 200 + Set-Cookie + user.name (LoginView success branch)')
  {
    const { res, body, cookies } = await httpLogin('budi@example.com', 'customer123')
    assert(res.status === 200, `expected 200, got ${res.status}`)
    assert(cookies.some(c => c.startsWith('anima_session=')), 'Set-Cookie: anima_session=<value>')
    assert(!!body.user?.name, 'response includes user.name')
    assert(!('password' in (body.user || {})), 'response.user does NOT include password')

    // Carry the session forward.
    ;(testHttpLoginFlow as any)._customerCookie = cookieFrom(cookies)
  }
}

async function testHttpAdminGate() {
  console.log('\n========================================')
  console.log('HTTP — admin action auth gate (matches OrdersView pre-flight)')
  console.log('========================================')

  console.log('\n[H4] GET /api/admin/orders without auth → 401')
  {
    const { res } = await httpGetWithCookie('/api/admin/orders', '')
    assert(res.status === 401, `expected 401, got ${res.status}`)
  }

  console.log('\n[H5] GET /api/admin/orders with customer session → 403')
  {
    const cookie = (testHttpLoginFlow as any)._customerCookie || ''
    assert(cookie.length > 0, 'customer session cookie available from H3')
    const { res } = await httpGetWithCookie('/api/admin/orders', cookie)
    assert(res.status === 403, `expected 403, got ${res.status}`)
  }

  console.log('\n[H6] GET /api/admin/orders with admin session → 200')
  {
    const { res, body, cookies } = await httpLogin('admin@anima.id', 'admin123')
    assert(res.status === 200, `admin login 200, got ${res.status}`)
    const adminCookie = cookieFrom(cookies)
    const { res: r2, body: b2 } = await httpGetWithCookie('/api/admin/orders', adminCookie)
    assert(r2.status === 200, `expected 200, got ${r2.status}`)
    assert(Array.isArray(b2.orders ?? b2), 'returns orders array')
    // Cleanup: logout admin
    await httpPostWithCookie('/api/auth/logout', adminCookie, {}).catch(() => {})
  }
}

async function testHttpCheckoutFlow() {
  console.log('\n========================================')
  console.log('HTTP — checkout action toast paths')
  console.log('========================================')

  console.log('\n[H7] POST /api/orders without auth → 401 (CheckoutView session-expired branch)')
  {
    const { res } = await httpPostWithCookie('/api/orders', '', {
      items: [],
      customerName: 'QA',
      customerPhone: '0812345678',
      address: 'Jl Test',
    })
    assert(res.status === 401, `expected 401, got ${res.status}`)
  }

  console.log('\n[H8] POST /api/orders with auth but empty items → 400 (CheckoutView 400 branch)')
  {
    const cookie = (testHttpLoginFlow as any)._customerCookie || ''
    assert(cookie.length > 0, 'customer session cookie available from H3')
    const { res, body } = await httpPostWithCookie('/api/orders', cookie, {
      items: [],
      customerName: 'QA Toast Test',
      customerPhone: '081234567890',
      address: 'Jl Test Saja',
    })
    assert(res.status === 400, `expected 400, got ${res.status}`)
    assert(!!body.error, 'response includes error message')
  }
}

async function testHttpLogout() {
  console.log('\n========================================')
  console.log('HTTP — logout cleanup')
  console.log('========================================')

  console.log('\n[H9] POST /api/auth/logout with customer session → 200 (clears cookie)')
  {
    const cookie = (testHttpLoginFlow as any)._customerCookie || ''
    assert(cookie.length > 0, 'customer session cookie available from H3')
    const { res } = await httpPostWithCookie('/api/auth/logout', cookie, {})
    assert(res.status === 200, `expected 200, got ${res.status}`)
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('══════════════════════════════════════════════════════════════════════')
  console.log('  Toast Standardization Audit V1')
  console.log(`  mode: ${HTTP_MODE ? 'HTTP integration (BASE_URL=' + BASE_URL + ')' : 'static-only'}`)
  console.log('══════════════════════════════════════════════════════════════════════')

  testSonnerSurface()
  testSonnerComponent()
  testLayoutMounting()
  testDeadRadixRemoval()
  testCallSiteSignatures()

  if (HTTP_MODE) {
    try {
      await testHttpLoginFlow()
      await testHttpAdminGate()
      await testHttpCheckoutFlow()
      await testHttpLogout()
    } catch (e: any) {
      console.log(`\n  ❌ HTTP test harness error: ${e?.message || e}`)
      fail++
      failures.push(`HTTP harness: ${e?.message || e}`)
    }
  } else {
    console.log('\n─────────────────────────────────────────────────────────')
    console.log('  Skipping HTTP integration tests — set BASE_URL to enable.')
    console.log('  e.g.  BASE_URL="http://localhost:3000" bun run scripts/test-toast.ts')
    console.log('─────────────────────────────────────────────────────────')
  }

  console.log('\n══════════════════════════════════════════════════════════════════════')
  console.log(`  Result: ${pass} passed, ${fail} failed`)
  if (fail > 0) {
    console.log('  Failures:')
    for (const f of failures) console.log(`   - ${f}`)
  }
  console.log('══════════════════════════════════════════════════════════════════════')
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(2)
})
