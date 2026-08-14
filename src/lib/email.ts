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
        `dev console adapter.`
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
      cachedAdapter = new NotImplementedEmailAdapter('resend')
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
