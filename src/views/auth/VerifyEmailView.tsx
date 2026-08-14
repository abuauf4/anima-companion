'use client'

import { useState, useEffect } from 'react'
import { useHashRouter } from '@/lib/router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckCircle2, XCircle, Loader2, MailCheck } from 'lucide-react'
import { toast } from 'sonner'

/**
 * VerifyEmailView — the landing page for `?token=<rawToken>` from the
 * verification email. Reads the token, POSTs it to
 * /api/auth/verify-email/confirm, and shows the result.
 *
 * The page is functional whether the user is logged in or not — the
 * verify endpoint does not require auth (the token IS the proof of
 * control). After successful verification, the user can navigate to
 * /login or /profile.
 *
 * States:
 *   - verifying   — initial; POST in flight
 *   - ok           — token consumed, email verified (freshly)
 *   - already_verified — token consumed, but email was already verified
 *   - already_consumed — token already used before (idempotent success)
 *   - expired      — token expired, must request a new one
 *   - not_found    — token hash does not exist in DB (malformed or
 *                    already-consumed-and-deleted by a future cleanup job)
 *   - error        — server error or missing token param
 */
type State =
  | { kind: 'verifying' }
  | { kind: 'ok' }
  | { kind: 'already_verified' }
  | { kind: 'already_consumed' }
  | { kind: 'expired' }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string }

export function VerifyEmailView() {
  const { route, navigate } = useHashRouter()
  const [state, setState] = useState<State>({ kind: 'verifying' })

  // The token comes from `?token=...` in the URL. We use the hash-router's
  // `route.query` (URLSearchParams) which already URL-decodes once.
  const token = route.query.get('token')

  useEffect(() => {
    if (!token) {
      setState({ kind: 'error', message: 'Token verifikasi tidak ditemukan di URL.' })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/auth/verify-email/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json()
        if (cancelled) return
        if (data.code === 'OK') setState({ kind: 'ok' })
        else if (data.code === 'ALREADY_VERIFIED') setState({ kind: 'already_verified' })
        else if (data.code === 'ALREADY_CONSUMED') setState({ kind: 'already_consumed' })
        else if (data.code === 'TOKEN_EXPIRED') setState({ kind: 'expired' })
        else if (data.code === 'TOKEN_NOT_FOUND') setState({ kind: 'not_found' })
        else setState({ kind: 'error', message: data.error || 'Terjadi kesalahan' })
      } catch {
        if (!cancelled) {
          setState({ kind: 'error', message: 'Tidak dapat terhubung ke server.' })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="container-page flex min-h-[80vh] items-center justify-center py-10">
      <div className="w-full max-w-md">
        <Card className="p-8 text-center">
          {state.kind === 'verifying' && (
            <>
              <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
              <h1 className="text-xl font-bold">Memverifikasi email Anda...</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Mohon tunggu sebentar.
              </p>
            </>
          )}

          {(state.kind === 'ok' || state.kind === 'already_verified' || state.kind === 'already_consumed') && (
            <>
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600" />
              <h1 className="text-xl font-bold">Email terverifikasi!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {state.kind === 'ok'
                  ? 'Email Anda berhasil diverifikasi. Akun Anima Companion Anda sekarang aktif penuh.'
                  : state.kind === 'already_verified'
                  ? 'Email Anda sudah terverifikasi sebelumnya. Tidak ada perubahan.'
                  : 'Tautan verifikasi ini sudah pernah digunakan. Email Anda sudah terverifikasi.'}
              </p>
              <Button className="mt-6 w-full" onClick={() => navigate('/profile')}>
                Lihat Profil Saya
              </Button>
              <Button variant="outline" className="mt-2 w-full" onClick={() => navigate('/')}>
                Kembali ke Beranda
              </Button>
            </>
          )}

          {state.kind === 'expired' && (
            <>
              <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
              <h1 className="text-xl font-bold">Tautan kedaluwarsa</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Tautan verifikasi ini sudah kedaluwarsa (berlaku 24 jam). Silakan minta tautan baru.
              </p>
              <Button className="mt-6 w-full" onClick={() => navigate('/profile')}>
                Minta Tautan Baru
              </Button>
            </>
          )}

          {(state.kind === 'not_found' || state.kind === 'error') && (
            <>
              <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
              <h1 className="text-xl font-bold">Tautan tidak valid</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {state.kind === 'error' ? state.message : 'Tautan verifikasi ini tidak valid atau sudah tidak berlaku.'}
              </p>
              <Button className="mt-6 w-full" onClick={() => navigate('/')}>
                Kembali ke Beranda
              </Button>
            </>
          )}
        </Card>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <MailCheck className="h-4 w-4" />
          <span>Anima Companion — Verified Identity V1</span>
        </div>
      </div>
    </div>
  )
}
