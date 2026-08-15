import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAuthError } from '@/lib/auth'
import { consumeOtp } from '@/lib/otp'
import { issueResetGrant } from '@/lib/password-reset'

/**
 * POST /api/auth/reset-password/verify-otp — verify a PASSWORD_RESET OTP
 * and issue a short-lived single-use reset grant.
 *
 * Body: `{ email: string, code: string }` — the user's email + the 6-digit
 * OTP from their email.
 *
 * NO AUTH REQUIRED — the user can't log in (that's why they're resetting).
 * The OTP IS the proof of control.
 *
 * Flow:
 *   1. Validate email format + code format (6-digit).
 *   2. Look up user by email. If NOT FOUND, return a fake-success response
 *      (anti-enumeration — see below).
 *   3. If user is GOOGLE-only, return a fake-success response (anti-enumeration).
 *   4. Call consumeOtp({ userId, purpose: 'PASSWORD_RESET', code }).
 *   5. On OK: call issueResetGrant(userId). Return the RAW grant to the
 *      client so it can be submitted with the new password in stage 7.
 *   6. On WRONG_CODE: return 409 + remainingAttempts (same as verify-email).
 *   7. On NOT_FOUND_OR_EXPIRED: return 404.
 *   8. On ALREADY_CONSUMED: return 200 ALREADY_CONSUMED (idempotent — but
 *      no grant is issued because the OTP was already consumed by a
 *      concurrent request which presumably also issued a grant).
 *
 * ANTI-ENUMERATION:
 *   This route is trickier than forgot-password because it returns a
 *   grant on success. We can't return a fake grant for non-existent users
 *   (the client would try to use it and fail). Instead, we return a
 *   NOT_FOUND_OR_EXPIRED-style response for non-existent users + GOOGLE
 *   users, which is indistinguishable from "the OTP was wrong / expired".
 *   The attacker doesn't learn whether the email exists.
 *
 *   Specifically:
 *     - Non-existent email → 404 NOT_FOUND_OR_EXPIRED (same as if the OTP
 *       was wrong). The attacker can't distinguish "email doesn't exist"
 *       from "email exists but OTP is wrong".
 *     - GOOGLE-only account → 404 NOT_FOUND_OR_EXPIRED (same). The attacker
 *       can't distinguish "this is a Google account" from "the OTP is wrong".
 *     - PASSWORD account + wrong OTP → 409 WRONG_CODE + remainingAttempts.
 *       ⚠️ This IS a minor enumeration vector — the attacker learns "email
 *       exists + is a PASSWORD account" from the 409 (vs 404 for non-existent).
 *       We accept this tradeoff because:
 *         (a) the forgot-password route (stage 5) already returns { sent: true }
 *             whether the email exists or not, so the attacker can't probe
 *             via forgot-password;
 *         (b) the attacker would have to first trigger a forgot-password
 *             OTP (which has its own 60s cooldown) before they can probe
 *             via verify-otp — so the attack rate is limited;
 *         (c) returning 409 with remainingAttempts is necessary for the
 *             UX (the user needs to know how many attempts they have left).
 *
 * SECURITY:
 *   - The OTP is HMAC-peppered (stage 1).
 *   - The grant is 32-byte CSPRNG, SHA-256 hashed in DB (stage 1).
 *   - The raw grant is returned to the client so it can be submitted with
 *     the new password. The grant is short-lived (10 min) + single-use.
 *   - The grant DOES NOT grant any authority by itself — it only authorizes
 *     the holder to call /api/auth/reset-password (stage 7) which sets a
 *     NEW password (the old password becomes invalid). A leaked grant is
 *     a password-reset trigger, not account takeover — the attacker would
 *     need to also know the user's email AND have the grant.
 *
 * RESPONSE CODES:
 *   - 200 `{ code: 'OK', grant, expiresAt }` — OTP verified, grant issued.
 *   - 200 `{ code: 'ALREADY_CONSUMED' }` — OTP was valid but a concurrent
 *     request already consumed it (and presumably issued a grant).
 *   - 400 `{ code: 'CODE_EMPTY' | 'CODE_FORMAT' | 'EMAIL_FORMAT' }` —
 *     input validation failure.
 *   - 404 `{ code: 'NOT_FOUND_OR_EXPIRED' }` — OTP not found / expired /
 *     locked / email doesn't exist / GOOGLE account (anti-enumeration).
 *   - 409 `{ code: 'WRONG_CODE', remainingAttempts }` — code is
 *     well-formed but does not match.
 *   - 500 `{ code: 'INTERNAL' }` — unexpected error.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, code } = body

    // ---- Input validation ----
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email wajib diisi', code: 'EMAIL_EMPTY' },
        { status: 400 }
      )
    }
    const trimmedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json(
        { error: 'Format email tidak valid', code: 'EMAIL_FORMAT' },
        { status: 400 }
      )
    }
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Kode reset wajib diisi', code: 'CODE_EMPTY' },
        { status: 400 }
      )
    }
    const trimmedCode = code.trim()
    if (!/^[0-9]{6}$/.test(trimmedCode)) {
      return NextResponse.json(
        { error: 'Kode reset harus 6 digit angka', code: 'CODE_FORMAT' },
        { status: 400 }
      )
    }

    // ---- Look up the user ----
    const user = await db.user.findUnique({
      where: { email: trimmedEmail },
      select: { id: true, email: true, name: true, provider: true, emailVerifiedAt: true },
    })

    // ANTI-ENUMERATION: if the user doesn't exist OR is GOOGLE-only,
    // return NOT_FOUND_OR_EXPIRED. The attacker can't distinguish this
    // from "the OTP was wrong / expired".
    if (!user || user.provider === 'GOOGLE') {
      return NextResponse.json(
        {
          error: 'Kode reset tidak ditemukan atau sudah kedaluwarsa. Silakan minta kode baru.',
          code: 'NOT_FOUND_OR_EXPIRED',
        },
        { status: 404 }
      )
    }

    // ---- Consume the OTP ----
    const otpResult = await consumeOtp({
      userId: user.id,
      purpose: 'PASSWORD_RESET',
      code: trimmedCode,
    })

    if (otpResult.result === 'OK') {
      // OTP verified — issue a short-lived single-use reset grant.
      // The grant is returned to the client so it can be submitted with
      // the new password in stage 7.
      const { grant, expiresAt } = await issueResetGrant(user.id)
      return NextResponse.json({
        code: 'OK',
        grant,
        expiresAt,
      })
    }

    if (otpResult.result === 'ALREADY_CONSUMED') {
      // Race lost — a concurrent verify won the claim and presumably
      // issued a grant. The user's intent (verify the code) has been
      // satisfied, but we don't have a grant to return. The user can
      // request a new OTP via /api/auth/forgot-password (subject to the
      // 60s cooldown).
      return NextResponse.json({ code: 'ALREADY_CONSUMED' })
    }

    if (otpResult.result === 'WRONG_CODE') {
      return NextResponse.json(
        {
          error: 'Kode reset salah',
          code: 'WRONG_CODE',
          remainingAttempts: otpResult.remainingAttempts,
        },
        { status: 409 }
      )
    }

    // NOT_FOUND_OR_EXPIRED — no unconsumed, unexpired, un-locked OTP.
    return NextResponse.json(
      {
        error: 'Kode reset tidak ditemukan atau sudah kedaluwarsa. Silakan minta kode baru.',
        code: 'NOT_FOUND_OR_EXPIRED',
      },
      { status: 404 }
    )
  } catch (e) {
    logAuthError('Reset-password verify-otp error', e)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server', code: 'INTERNAL' },
      { status: 500 }
    )
  }
}
