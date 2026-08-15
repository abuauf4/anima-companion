import { NextResponse } from 'next/server'
import { destroyAdminSession } from '@/lib/admin-auth'

// ============================================================================
// POST /api/admin/auth/logout — Internal admin realm logout.
//
// Clears the `anima_admin_session` cookie. Does NOT touch `anima_session`
// (the customer cookie) — the two realms are fully separated.
//
// No body required. Always returns 200 (even if no session was present —
// logout is idempotent and must not leak whether a session existed).
// ============================================================================

export async function POST() {
  try {
    await destroyAdminSession()
    return NextResponse.json({ ok: true })
  } catch {
    // Even on error, return 200 so the client navigates to /admin/login
    // regardless. A failed logout should not trap the user in the panel.
    return NextResponse.json({ ok: true })
  }
}
