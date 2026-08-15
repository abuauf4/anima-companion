/**
 * Email adapter — pluggable abstraction for delivering transactional emails.
 *
 * AUDIT FINDING (Verified Identity V1):
 *   - `nodemailer` is NOT installed (only a peer-dep of next-auth@4).
 *   - No SMTP service is configured in `.env.example` or in the repo.
 *   - No sendgrid / mailgun / resend / postmark SDK is installed.
 *   - The `z-ai-web-dev-sdk` is present but does NOT expose an email-send
 *     primitive (it is for AI / web-search / image-gen / VLM).
 *
 * Per the task spec: "Kalau pengiriman email membutuhkan service/provider
 * yang belum tersedia, jangan invent atau diam-diam menambah layanan
 * berbayar. Audit opsi yang sudah ada di repo/environment dan report
 * dependency yang dibutuhkan. Implementasikan sebanyak yang bisa
 * dilakukan secara benar tanpa fake email-delivery behavior."
 *
 * IMPLEMENTATION:
 *   - The default adapter is `DevConsoleEmailAdapter`, which logs the
 *     email body to the server console (stdout) so the developer can see
 *     the verification link during local development. This is NOT a fake
 *     send — it is the honest fallback when no provider is configured.
 *   - In production with `NODE_ENV=production`, the dev adapter REFUSES to
 *     send and logs a CONFIG-MISSING error instead. This forces the
 *     operator to wire a real provider before the app goes live — silent
 *     failure would let unverified-password users believe they're verified.
 *   - When a real provider is wired (V2: Resend / SendGrid / SES / SMTP),
 *     the operator sets `EMAIL_PROVIDER=resend|sendgrid|ses|smtp` and
 *     the corresponding credentials. The adapter switch below picks the
 *     right implementation. For V1 only `DevConsoleEmailAdapter` is
 *     implemented — the rest are stubs that throw `EMAIL_PROVIDER_NOT_
 *     IMPLEMENTED` so it's obvious which dependency is missing.
 *
 * SECURITY:
 *   - The verification link inside the email contains a one-time token.
 *     The dev adapter prints it to stdout so the developer can paste it
 *     into a browser. In production, stdout is typically captured by log
 *     aggregation — but the token is single-use AND hashed in the DB, so
 *     a log-leak of an unopened verification email is a minor exposure
 *     (the attacker can verify the user's email, but cannot take over the
 *     account — they would need the password too, or the active session).
 *     The 24h expiry further limits the window.
 *
 * PRODUCTION LOGGING INVARIANT (Verified Identity V1 cleanup):
 *   - In production, the dev adapter MUST NEVER log the raw verification
 *     token OR the full verification URL — only the CONFIG-MISSING
 *     message (which does NOT include the token or URL). This is enforced
 *     by the early `if (process.env.NODE_ENV === 'production')` return
 *     at the top of `DevConsoleEmailAdapter.send()`, BEFORE the
 *     `console.log` that prints the email body. The source-level test
 *     `SRC9` in `scripts/test-verified-identity.ts` enforces this
 *     invariant: it parses this file's source and asserts that any
 *     `console.log` call that references the message body / token /
 *     verificationUrl is reachable ONLY in a code path gated by a
 *     `NODE_ENV !== 'production'` check.
 *   - When V2 wires a real provider (Resend/SendGrid/SES/SMTP), the
 *     adapter implementation MUST also never log the raw token or URL.
 *     The test invariant `SRC9` should be extended to cover the new
 *     adapter's source at that time.
 */

export interface EmailMessage {
  to: string
  subject: string
  // Plain-text body. The verification link is embedded here.
  text: string
  // Optional HTML body. If omitted, the text version is sent as-is.
  html?: string
}

export interface EmailAdapter {
  send(message: EmailMessage): Promise<void>
}

// ----------------------------------------------------------------------------
// DevConsoleEmailAdapter — default. Logs the email to stdout in development,
// refuses to send in production (forces operator to wire a real provider).
// ----------------------------------------------------------------------------
class DevConsoleEmailAdapter implements EmailAdapter {
  async send(message: EmailMessage): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      // In production, we MUST NOT silently swallow the email — that would
      // let users register a password account and never receive a
      // verification link, then believe they're stuck. The operator must
      // configure a real provider. Log a loud CONFIG-MISSING error so it
      // shows up in the deploy dashboard.
      console.error(
        '[EMAIL] CONFIG-MISSING: EMAIL_PROVIDER is not set. ' +
          'Verification email could NOT be sent to ' +
          message.to +
          '. Set EMAIL_PROVIDER=resend|sendgrid|ses|smtp and the ' +
          'corresponding credentials in production env vars. ' +
          'See src/lib/email.ts for the adapter contract.'
      )
      return
    }
    // Development: print the email body so the developer can paste the
    // verification link into a browser. This is the "as much as can be
    // done correctly without fake email-delivery behavior" path.
    console.log('────────── EMAIL (dev console adapter) ──────────')
    console.log('To:      ' + message.to)
    console.log('Subject: ' + message.subject)
    console.log('────────── BODY ──────────')
    console.log(message.text)
    console.log('────────── END EMAIL ──────────')
  }
}

// ----------------------------------------------------------------------------
// ResendEmailAdapter — production email delivery via Resend (resend.com).
// Single provider — task spec says "Jangan menambahkan beberapa provider
// sekaligus". Resend is preferred for simplicity + reliability.
//
// REQUIRED ENV VARS when EMAIL_PROVIDER=resend:
//   RESEND_API_KEY   — server-only, NEVER expose via NEXT_PUBLIC_*
//   EMAIL_FROM       — e.g. "Anima Companion <noreply@animacompanion.id>"
//                      Must be a verified sender domain in Resend dashboard.
//
// SECURITY:
//   - If EMAIL_PROVIDER=resend but RESEND_API_KEY is missing/empty, the
//     constructor throws — the server will refuse to start. We do NOT
//     silently fall back to the dev adapter in production — that would
//     hide the misconfiguration and let unverified users believe their
//     email was sent.
//   - The adapter NEVER logs the raw email body, the raw verification
//     token, or the verification URL. Resend API errors are caught by
//     the caller (register/verify routes) and routed through
//     `logAuthError` which sanitizes in production.
//   - `EMAIL_FROM` is a server-side constant — the recipient is set per
//     message from `EmailMessage.to` (always a user's submitted email).
// ----------------------------------------------------------------------------
class ResendEmailAdapter implements EmailAdapter {
  private readonly apiKey: string
  private readonly from: string

  constructor() {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.EMAIL_FROM
    if (!apiKey || !apiKey.trim()) {
      throw new Error(
        'EMAIL_PROVIDER=resend but RESEND_API_KEY is not set. ' +
          'Set RESEND_API_KEY in the deployment environment (NEVER commit). ' +
          'See src/lib/email.ts and .env.example.'
      )
    }
    if (!from || !from.trim()) {
      throw new Error(
        'EMAIL_PROVIDER=resend but EMAIL_FROM is not set. ' +
          'Set EMAIL_FROM to a verified sender address (e.g. ' +
          '"Anima Companion <noreply@animacompanion.id>"). ' +
          'The domain must be verified in the Resend dashboard.'
      )
    }
    this.apiKey = apiKey
    this.from = from
  }

  async send(message: EmailMessage): Promise<void> {
    // Lazy-import so the dependency is only loaded when Resend is actually
    // wired. This keeps the dev adapter path zero-cost for local dev.
    const { Resend } = await import('resend')
    const client = new Resend(this.apiKey)
    // SECURITY: never log message.text/html — they contain the verification
    // token + URL. We only surface a stable event label via the caller's
    // logAuthError catch block if Resend throws.
    const { error } = await client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    })
    if (error) {
      // Wrap the Resend error into a plain Error so the caller's
      // logAuthError catch can sanitize it (production logs only
      // `{ event, status }`). Do NOT interpolate error.message into
      // any thrown/logged string in production paths.
      throw new Error(
        `Resend API returned error (name=${error.name}). ` +
          `Check the Resend dashboard for delivery details. ` +
          `(Full error message is suppressed for security — see server logs only in dev.)`
      )
    }
  }
}

// ----------------------------------------------------------------------------
// Stubs for future V2 providers. Each throws a clear NOT-IMPLEMENTED error
// so the operator knows which dependency is missing.
// ----------------------------------------------------------------------------
class NotImplementedEmailAdapter implements EmailAdapter {
  constructor(private providerName: string) {}
  async send(_message: EmailMessage): Promise<void> {
    throw new Error(
      `EMAIL_PROVIDER=${this.providerName} is not implemented yet. ` +
        `Install the corresponding SDK and wire it in src/lib/email.ts. ` +
        `For now, set EMAIL_PROVIDER=dev (or leave unset) to use the ` +
        `dev console adapter, or EMAIL_PROVIDER=resend for production.`
    )
  }
}

// ----------------------------------------------------------------------------
// Adapter factory — picks the right implementation based on env var.
// ----------------------------------------------------------------------------
let cachedAdapter: EmailAdapter | null = null

export function getEmailAdapter(): EmailAdapter {
  if (cachedAdapter) return cachedAdapter
  const provider = (process.env.EMAIL_PROVIDER || 'dev').toLowerCase()
  switch (provider) {
    case 'dev':
    case '':
      cachedAdapter = new DevConsoleEmailAdapter()
      break
    case 'resend':
      cachedAdapter = new ResendEmailAdapter()
      break
    case 'sendgrid':
      cachedAdapter = new NotImplementedEmailAdapter('sendgrid')
      break
    case 'ses':
      cachedAdapter = new NotImplementedEmailAdapter('ses')
      break
    case 'smtp':
      cachedAdapter = new NotImplementedEmailAdapter('smtp')
      break
    default:
      console.error(
        `[EMAIL] Unknown EMAIL_PROVIDER="${provider}". Falling back to dev console adapter.`
      )
      cachedAdapter = new DevConsoleEmailAdapter()
  }
  return cachedAdapter
}

/**
 * Send a verification email. Builds the email body with the verification
 * link, then hands it off to the configured adapter.
 *
 * The verification link points at `/verify-email?token=<rawToken>` on the
 * application's own origin. The origin is derived from:
 *   1. `NEXT_PUBLIC_SITE_URL` env var (canonical production origin —
 *      already used for SEO / sitemap).
 *   2. Fall back to `http://localhost:3000` in dev.
 *
 * We deliberately do NOT use the incoming request's `Host` header to
 * derive the origin, because that would be vulnerable to host-header
 * injection (an attacker sets `Host: evil.com` in the request, the app
 * emails a link to `evil.com/verify-email?token=...`, and the attacker
 * steals the token). The canonical origin is a server-side constant.
 */
export async function sendVerificationEmail(
  to: string,
  rawToken: string,
  userName?: string
): Promise<void> {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  // The token is sent as a query param. The verify route will look it up
  // by hash. The token is single-use, so even if the link is forwarded
  // or screenshotted after consumption, it's useless.
  const verificationUrl = `${origin.replace(/\/$/, '')}/verify-email?token=${rawToken}`
  const subject = 'Verifikasi email Anda — Anima Companion'
  const text = `Halo${userName ? ' ' + userName : ''},

Terima kasih sudah mendaftar di Anima Companion.

Klik tautan berikut untuk memverifikasi email Anda:

${verificationUrl}

Tautan ini berlaku selama 24 jam dan hanya bisa digunakan satu kali.

Jika Anda tidak mendaftar akun ini, abaikan email ini — akun tidak akan dibuat tanpa verifikasi.

Salam,
Tim Anima Companion
PT Sutan Vet Medika`

  await getEmailAdapter().send({ to, subject, text })
}

/**
 * Send a "your email has been verified" confirmation email. Optional —
 * only used if we want to give the user positive feedback. For V1 this
 * is informational; the verify route's success page is the primary UI.
 */
export async function sendVerifiedConfirmation(
  to: string,
  userName?: string
): Promise<void> {
  const subject = 'Email terverifikasi — Anima Companion'
  const text = `Halo${userName ? ' ' + userName : ''},

Email Anda sudah terverifikasi. Akun Anima Companion Anda sekarang aktif penuh.

Salam,
Tim Anima Companion
PT Sutan Vet Medika`
  await getEmailAdapter().send({ to, subject, text })
}

/**
 * Send a 6-digit OTP email for email verification (V2 flow).
 *
 * The OTP is the RAW 6-digit code. The caller (the register / send-otp
 * route) is responsible for delivering it via this function IMMEDIATELY
 * after `issueOtp()` returns, so the `lastSentAt` timestamp recorded at
 * issuance time matches the actual email dispatch time (the 60-second
 * resend cooldown is computed against `lastSentAt`).
 *
 * SECURITY:
 *   - In dev, the DevConsoleEmailAdapter prints the OTP to stdout so the
 *     developer can read it and paste it into the verify-OTP form.
 *   - In production with EMAIL_PROVIDER=resend, the OTP is sent via Resend
 *     to the user's email address. The OTP is short-lived (10 min) and
 *     single-use, so a leaked email has limited usability.
 *   - The ResendEmailAdapter NEVER logs the email body (which contains
 *     the OTP) — only the caller's logAuthError catch can surface a
 *     stable event label.
 *
 * WHY A SUBJECT LINE THAT SAYS "Kode verifikasi" (NOT "Click this link"):
 *   The V1 link-based flow used a clickable link in the email body. The V2
 *   OTP flow uses a 6-digit code that the user manually enters into the
 *   verify-OTP form. The subject line and body must make this clear so
 *   the user doesn't try to click anything in the email.
 *
 * @param to The recipient email address.
 * @param code The RAW 6-digit OTP code. NEVER log this, NEVER return it
 *             in an API response body.
 * @param userName Optional recipient name for the greeting.
 * @param purposeLabel Optional human-readable label for the email's
 *                     purpose (e.g. "verifikasi email" or "reset password").
 *                     Defaults to "verifikasi email".
 */
export async function sendOtpEmail(
  to: string,
  code: string,
  userName?: string,
  purposeLabel: string = 'verifikasi email'
): Promise<void> {
  const subject = `Kode ${purposeLabel} Anda — ${code}`
  const text = `Halo${userName ? ' ' + userName : ''},

Berikut adalah kode ${purposeLabel} untuk akun Anima Companion Anda:

    ${code}

Kode ini berlaku selama 10 menit dan hanya bisa digunakan satu kali.

Jika Anda tidak meminta kode ini, abaikan email ini — akun Anda tetap aman.

Salam,
Tim Anima Companion
PT Sutan Vet Medika`
  await getEmailAdapter().send({ to, subject, text })
}
