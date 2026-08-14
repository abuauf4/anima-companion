import { NextRequest, NextResponse } from 'next/server'
import { logAuthError } from '@/lib/auth'
import { consumeVerificationToken, markEmailVerified, VerifyTokenResult } from '@/lib/identity'
import { sendVerifiedConfirmation } from '@/lib/email'
import { db } from '@/lib/db'

/**
 * POST /api/auth/verify-email/confirm — verify an email verification token.
 *
 * Body: `{ token: string }` — the raw token from the verification link.
 *
 * Behavior:
 *   - Look up the token by SHA-256 hash. The raw token NEVER appears in
 *     the DB.
 *   - If the token is NOT_FOUND → 404 with `{ code: 'TOKEN_NOT_FOUND' }`.
 *   - If the token is EXPIRED → 410 with `{ code: 'TOKEN_EXPIRED' }`.
 *   - If the token was already consumed → 200 with `{ code: 'ALREADY_CONSUMED' }`
 *     (idempotent — the user clicked the link twice, or two requests raced).
 *     We DON'T return an error here because the outcome the user wanted
 *     (their email is verified) has already happened. The response is a
 *     success-status so the client doesn't show a scary error toast.
 *   - If the token was successfully consumed AND the user was already
 *     verified → 200 with `{ code: 'ALREADY_VERIFIED' }` (idempotent).
 *   - If the token was successfully consumed AND this is a fresh
 *     verification → 200 with `{ code: 'OK', emailVerifiedAt: <date> }`.
 *
 * CONCURRENCY:
 *   - Two requests with the same valid token race. Only one wins the
 *     atomic `updateMany WHERE consumedAt IS NULL` — the loser gets
 *     `count=0` and we surface that as `ALREADY_CONSUMED`.
 *   - Two requests with DIFFERENT tokens for the same user cannot
 *     happen, because requesting a new token invalidates all previous
 *     unconsumed tokens. Only one valid token per user exists at a time.
 *
 * We also issue the SAME `anima_session` cookie the user already had
 * (no session change) — verification state lives in the DB, not the
 * session. The next time the client calls `/api/auth/me`, the
 * `emailVerifiedAt` field will be present.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token } = body

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Token verifikasi wajib diisi', code: 'TOKEN_EMPTY' },
        { status: 400 }
      )
    }

    const result = await consumeVerificationToken(token)

    let responseCode: VerifyTokenResult = result.result
    let emailVerifiedAt: Date | null = null

    if (result.result === 'OK' || result.result === 'ALREADY_VERIFIED') {
      // The token was valid. Mark the user's email as verified (idempotent).
      if (result.userId) {
        emailVerifiedAt = await markEmailVerified(result.userId)
        // Send a confirmation email — best-effort, don't fail the verify
        // if the email adapter can't send.
        try {
          const user = await db.user.findUnique({
            where: { id: result.userId },
            select: { email: true, name: true },
          })
          if (user) {
            await sendVerifiedConfirmation(user.email, user.name ?? undefined)
          }
        } catch {
          // Email adapter failure is non-fatal — the verification itself
          // already succeeded. Just log.
          console.error('[verify-email/confirm] Failed to send confirmation email')
        }
      }
    }

    // Map internal result to wire-level code.
    let wireCode: string
    let httpStatus: number
    switch (responseCode) {
      case 'OK':
        wireCode = 'OK'
        httpStatus = 200
        break
      case 'ALREADY_VERIFIED':
        wireCode = 'ALREADY_VERIFIED'
        httpStatus = 200
        break
      case 'ALREADY_CONSUMED':
        wireCode = 'ALREADY_CONSUMED'
        httpStatus = 200
        break
      case 'EXPIRED':
        wireCode = 'TOKEN_EXPIRED'
        httpStatus = 410
        break
      case 'NOT_FOUND':
      default:
        wireCode = 'TOKEN_NOT_FOUND'
        httpStatus = 404
        break
    }

    return NextResponse.json(
      {
        code: wireCode,
        ...(emailVerifiedAt ? { emailVerifiedAt } : {}),
      },
      { status: httpStatus }
    )
  } catch (e) {
    logAuthError('Verify-email confirm error', e)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server', code: 'INTERNAL' },
      { status: 500 }
    )
  }
}
