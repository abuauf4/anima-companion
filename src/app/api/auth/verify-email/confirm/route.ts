import { NextRequest, NextResponse } from 'next/server'
import { logAuthError } from '@/lib/auth'
import { consumeVerificationToken, VerifyTokenResult } from '@/lib/identity'

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
 * TRANSACTION BOUNDARY (Verified Identity V1 cleanup v2 — interactive tx):
 *   The token consumption AND the `emailVerifiedAt` write happen in the
 *   SAME interactive `db.$transaction(async (tx) => { ... })` inside
 *   `consumeVerificationToken`. There is NO separate `markEmailVerified`
 *   call from this route. The transaction:
 *     (1) looks up the token row inside the tx
 *     (2) atomically claims the token via `updateMany WHERE consumedAt IS
 *         NULL AND expiresAt > now` (only one concurrent request can win)
 *     (3) GATES: if `claim.count !== 1`, returns `ALREADY_CONSUMED` and
 *         DOES NOT write `emailVerifiedAt` — this is the critical fix
 *         over the v1 array-form `$transaction([...])`, which could not
 *         short-circuit on `count: 0` and would let the user write fire
 *         even when the token claim lost the race
 *     (4) ONLY if `claim.count === 1`: idempotently writes
 *         `emailVerifiedAt` via `updateMany WHERE emailVerifiedAt IS NULL`
 *
 *   Atomicity: if anything throws between the token claim and the user
 *   write, the entire transaction rolls back — the token is NOT consumed
 *   and the user is NOT verified. The user can retry. This closes the
 *   unrecoverable window from the V1 baseline (`61983c8`) where the two
 *   operations were sequential.
 *
 * CONCURRENCY:
 *   - Two requests with the same valid token race. Only one wins the
 *     atomic `updateMany WHERE consumedAt IS NULL` — the loser gets
 *     `count=0` and we surface that as `ALREADY_CONSUMED` (NO user
 *     write fires for the loser — the v2 gate ensures this).
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

    // consumeVerificationToken atomically (interactive $transaction):
    //   (1) looks up the token row
    //   (2) atomically claims the token (updateMany WHERE consumedAt IS
    //       NULL AND expiresAt > now — only one concurrent request can win)
    //   (3) GATES on claim.count === 1: if the claim lost the race
    //       (count=0), returns ALREADY_CONSUMED WITHOUT writing
    //       emailVerifiedAt — this is the v2 fix over the v1 array-form
    //       $transaction which could not short-circuit on count=0
    //   (4) ONLY if claim.count === 1: idempotently sets User.emailVerifiedAt
    // Both mutations commit in the SAME Prisma $transaction. If (4)
    // throws, (2) is rolled back — no unrecoverable window.
    const result = await consumeVerificationToken(token)

    let emailVerifiedAt: Date | null = null
    if (result.result === 'OK' || result.result === 'ALREADY_VERIFIED') {
      emailVerifiedAt = result.emailVerifiedAt ?? null
      // NOTE: We deliberately do NOT send a "your email is verified"
      // confirmation email here. The user has just proven control of
      // their inbox by clicking the verification link — a second email
      // would be redundant noise. The success state is communicated
      // via the response body (`code: 'OK', emailVerifiedAt`) and the
      // UI's Sonner toast / success card. This mirrors the V2 OTP
      // verification flow in verify-email/verify-otp/route.ts which
      // also sends zero post-verification emails.
    }

    // Map internal result to wire-level code.
    let wireCode: string
    let httpStatus: number
    switch (result.result) {
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
