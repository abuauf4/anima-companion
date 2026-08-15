import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, logAuthError } from '@/lib/auth'
import { hashResetGrant, constantTimeEqualGrantHash } from '@/lib/password-reset'

/**
 * POST /api/auth/reset-password — set a new password using a reset grant.
 *
 * Body: `{ grant: string, newPassword: string }` — the raw 64-char hex grant
 * from /api/auth/reset-password/verify-otp + the new password.
 *
 * NO AUTH REQUIRED — the grant IS the proof of authority (it was issued
 * only after the user successfully verified their PASSWORD_RESET OTP).
 *
 * ATOMIC TRANSACTION (V2 spec — critical):
 *   The grant claim, password update, sessionVersion bump, and OTP
 *   invalidation all happen in the SAME interactive
 *   `db.$transaction(async (tx) => { ... })`. If ANY of these mutations
 *   throws, the entire transaction rolls back — the grant is NOT consumed
 *   and the password is NOT changed. The user can retry.
 *
 *   Steps inside the transaction:
 *     (1) Look up the grant row by `grantHash = sha256(rawGrant)`. If not
 *         found → 404 GRANT_NOT_FOUND.
 *     (2) If `consumedAt` is set → 409 GRANT_CONSUMED (already used).
 *     (3) If `expiresAt <= now` → 410 GRANT_EXPIRED.
 *     (4) Atomically claim the grant via
 *         `updateMany WHERE id = row.id AND consumedAt IS NULL AND
 *         expiresAt > now` — only one of two concurrent requests with the
 *         same grant can win. The loser gets `claim.count === 0` →
 *         409 GRANT_CONSUMED.
 *     (5) GATE on `claim.count === 1`. If the claim lost the race, NO
 *         further mutation happens.
 *     (6) Hash the new password with bcrypt (10 rounds).
 *     (7) Update User: set `password = hashedNewPassword` AND
 *         `sessionVersion = sessionVersion + 1`. The sessionVersion bump
 *         invalidates all prior sessions (next /api/auth/me call will
 *         see a mismatch between the session cookie's sessionVersion
 *         and the DB's sessionVersion, and will treat the session as
 *         invalid).
 *     (8) Invalidate all unconsumed OTPs for this user (any purpose) by
 *         setting `consumedAt = now()`. This prevents a partially-attacked
 *         PASSWORD_RESET OTP from being reused after the password is
 *         changed.
 *
 * ANTI-ENUMERATION:
 *   This route requires a valid grant. The grant was issued ONLY after the
 *   user successfully verified their PASSWORD_RESET OTP. So we don't need
 *   anti-enumeration here — the attacker would need a valid grant to even
 *   reach this route, and a valid grant is proof that the user exists.
 *   The route returns distinct error codes (GRANT_NOT_FOUND,
 *   GRANT_CONSUMED, GRANT_EXPIRED) so the client can show appropriate
 *   UX (e.g. "sesi reset kedaluwarsa, silakan minta kode baru").
 *
 * SECURITY:
 *   - The grant is 32-byte CSPRNG, SHA-256 hashed in DB (stage 1).
 *   - Constant-time comparison via `constantTimeEqualGrantHash` (stage 1).
 *   - The new password is bcrypt-hashed with 10 rounds (same as register
 *     and login compare).
 *   - The sessionVersion bump invalidates ALL prior sessions — the user
 *     must re-authenticate with the new password. This closes the
 *     "attacker stole the old password and is using it to log in from
 *     another device" attack: after reset, the attacker's session is
 *     invalid too.
 *   - All unconsumed OTPs for the user are invalidated — a partially-
 *     attacked PASSWORD_RESET OTP cannot be reused after the password
 *     is changed.
 *
 * RESPONSE CODES:
 *   - 200 `{ code: 'OK' }` — password reset, sessionVersion bumped,
 *     OTPs invalidated. The client should redirect the user to /login.
 *   - 400 `{ code: 'GRANT_EMPTY' | 'PASSWORD_EMPTY' | 'PASSWORD_TOO_SHORT' }` —
 *     input validation failure.
 *   - 404 `{ code: 'GRANT_NOT_FOUND' }` — grant hash doesn't match any row.
 *   - 409 `{ code: 'GRANT_CONSUMED' }` — grant already consumed (or race
 *     lost to a concurrent reset).
 *   - 410 `{ code: 'GRANT_EXPIRED' }` — grant expired (10-min TTL).
 *   - 500 `{ code: 'INTERNAL' }` — unexpected error.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { grant, newPassword } = body

    // ---- Input validation ----
    if (!grant || typeof grant !== 'string') {
      return NextResponse.json(
        { error: 'Sesi reset tidak valid', code: 'GRANT_EMPTY' },
        { status: 400 }
      )
    }
    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json(
        { error: 'Password baru wajib diisi', code: 'PASSWORD_EMPTY' },
        { status: 400 }
      )
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password minimal 6 karakter', code: 'PASSWORD_TOO_SHORT' },
        { status: 400 }
      )
    }

    // Hash the raw grant to look up the matching row.
    const grantHash = hashResetGrant(grant)
    const now = new Date()

    // ---- Atomic interactive transaction ----
    // The interactive form (NOT array form) lets us branch on claim.count
    // BEFORE issuing the password update + sessionVersion bump. This is
    // critical: the array form would proceed to the next operation even
    // if the claim returned count:0 (race lost).
    const result = await db.$transaction(async (tx) => {
      // (1) Look up the grant row by hash.
      const row = await tx.passwordResetGrant.findUnique({
        where: { grantHash },
        select: { id: true, userId: true, consumedAt: true, expiresAt: true },
      })

      if (!row) {
        return { code: 'GRANT_NOT_FOUND' as const, httpStatus: 404 }
      }
      if (row.consumedAt) {
        return { code: 'GRANT_CONSUMED' as const, httpStatus: 409 }
      }
      if (row.expiresAt <= now) {
        return { code: 'GRANT_EXPIRED' as const, httpStatus: 410 }
      }

      // (4) Atomically claim the grant. Only one of two concurrent
      //     requests with the same grant can win.
      const claim = await tx.passwordResetGrant.updateMany({
        where: {
          id: row.id,
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      })

      // (5) GATE — if the claim lost the race, do NOT proceed.
      if (claim.count !== 1) {
        return { code: 'GRANT_CONSUMED' as const, httpStatus: 409 }
      }

      // (6) Hash the new password with bcrypt.
      const hashedNewPassword = await hashPassword(newPassword)

      // (7) Update User: set new password AND bump sessionVersion.
      //     The sessionVersion bump invalidates all prior sessions.
      //     Use updateMany (not update) so we can assert the where clause
      //     — though here it's just by id, so update would work too.
      //     We use update to get the updated row back (optional).
      await tx.user.update({
        where: { id: row.userId },
        data: {
          password: hashedNewPassword,
          sessionVersion: { increment: 1 },
        },
        select: { id: true },
      })

      // (8) Invalidate all unconsumed OTPs for this user (any purpose).
      //     This prevents a partially-attacked PASSWORD_RESET OTP from
      //     being reused after the password is changed.
      await tx.otpCode.updateMany({
        where: { userId: row.userId, consumedAt: null },
        data: { consumedAt: now },
      })

      return { code: 'OK' as const, httpStatus: 200 }
    })

    return NextResponse.json(
      { code: result.code },
      { status: result.httpStatus }
    )
  } catch (e) {
    logAuthError('Reset-password error', e)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server', code: 'INTERNAL' },
      { status: 500 }
    )
  }
}
