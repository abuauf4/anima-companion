'use client'

import { useState, useEffect, useRef } from 'react'
import { useHashRouter } from '@/lib/router'
import { safeInternalPath } from '@/lib/redirect'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { CheckCircle2, XCircle, Loader2, MailCheck, RefreshCw, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

/**
 * VerifyEmailView — V2 OTP-based email verification page.
 *
 * V1 behavior (preserved for backward compat):
 *   - If `?token=<rawToken>` is in the URL, the page submits it to
 *     /api/auth/verify-email/confirm (V1 link-token flow). Already-issued
 *     V1 link tokens still consume via this path. The user reaches this
 *     path by clicking a V1 verification link in their email.
 *
 * V2 behavior (new):
 *   - If NO `?token=` is in the URL, the page shows a 6-digit OTP input
 *     form. The user enters the code from their email and submits to
 *     /api/auth/verify-email/verify-otp.
 *   - The OTP input uses the shadcn `input-otp` component (6 single-digit
 *     slots, auto-advance on type, paste-friendly).
 *   - A "Kirim ulang" button lets the user request a new OTP (subject to
 *     the 60-second server-side resend cooldown — the API returns 429
 *     with retryAfterMs if the cooldown is active, and the UI shows a
 *     countdown).
 *   - On successful verification, the page redirects to the safe-internal
 *     `?next=` path (if present) or to `/` (home).
 *
 * States (V2 OTP flow):
 *   - idle        — initial; OTP form visible, user hasn't submitted yet.
 *   - verifying   — POST in flight.
 *   - ok          — OTP verified, emailVerifiedAt set.
 *   - already_verified — OTP consumed but email was already verified.
 *   - already_consumed — OTP was valid but a concurrent request won the
 *     claim race. Idempotent success.
 *   - wrong_code  — code is well-formed but does not match. Shows
 *     remainingAttempts.
 *   - not_found_or_expired — no unconsumed, unexpired OTP. User must
 *     request a new one.
 *   - error       — server error or session expired.
 *
 * Mobile-first:
 *   - Card max-width md (28rem) — fits mobile viewport.
 *   - OTP slots are 2.5rem (40px) — touch-friendly tap target.
 *   - Buttons are full-width on mobile.
 *   - Resend button is disabled during cooldown; shows countdown.
 */
type V2State =
  | { kind: 'idle' }
  | { kind: 'verifying' }
  | { kind: 'ok' }
  | { kind: 'already_verified' }
  | { kind: 'already_consumed' }
  | { kind: 'wrong_code'; remainingAttempts: number }
  | { kind: 'not_found_or_expired' }
  | { kind: 'error'; message: string }

// V1 link-token states (preserved for backward compat).
type V1State =
  | { kind: 'verifying' }
  | { kind: 'ok' }
  | { kind: 'already_verified' }
  | { kind: 'already_consumed' }
  | { kind: 'expired' }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string }

export function VerifyEmailView() {
  const { route, navigate } = useHashRouter()
  const { user, refresh: refreshAuth } = useAuth()
  const token = route.query.get('token')

  // If `?token=` is present, we're in V1 link-token mode (preserved for
  // backward compat). Otherwise, we're in V2 OTP mode (new).
  if (token) {
    return <V1LinkTokenView token={token} navigate={navigate} />
  }
  return (
    <V2OtpView
      navigate={navigate}
      nextPath={safeInternalPath(route.query.get('next'))}
      user={user}
      refreshAuth={refreshAuth}
    />
  )
}

// ---------------------------------------------------------------------------
// V2 OTP view (new)
// ---------------------------------------------------------------------------

interface V2OtpViewProps {
  navigate: (path: string) => void
  nextPath: string | null
  user: ReturnType<typeof useAuth>['user']
  refreshAuth: () => Promise<void>
}

function V2OtpView({ navigate, nextPath, user, refreshAuth }: V2OtpViewProps) {
  const [state, setState] = useState<V2State>({ kind: 'idle' })
  const [code, setCode] = useState('')
  const [resending, setResending] = useState(false)
  // Cooldown countdown in seconds. 0 = no cooldown active.
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start the cooldown countdown timer. Called after:
  //   - a successful resend (server returns the new resendAvailableAt)
  //   - a 429 response (server returns retryAfterMs)
  const startCooldown = (seconds: number) => {
    // Clear any existing timer.
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current)
    }
    setCooldownSeconds(seconds)
    cooldownTimerRef.current = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current)
            cooldownTimerRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current)
      }
    }
  }, [])

  // ---- Submit the OTP code to the verify-otp route ----
  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error('Kode verifikasi harus 6 digit')
      return
    }
    setState({ kind: 'verifying' })
    try {
      const res = await fetch('/api/auth/verify-email/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (data.code === 'OK') {
        setState({ kind: 'ok' })
        toast.success('Email berhasil diverifikasi!')
        await refreshAuth()
      } else if (data.code === 'ALREADY_VERIFIED') {
        setState({ kind: 'already_verified' })
        toast.success('Email Anda sudah terverifikasi.')
      } else if (data.code === 'ALREADY_CONSUMED') {
        setState({ kind: 'already_consumed' })
      } else if (data.code === 'WRONG_CODE') {
        setState({ kind: 'wrong_code', remainingAttempts: data.remainingAttempts })
        toast.error(`Kode salah. Sisa percobaan: ${data.remainingAttempts}`)
        setCode('') // Clear the input so the user can re-type.
      } else if (data.code === 'NOT_FOUND_OR_EXPIRED') {
        setState({ kind: 'not_found_or_expired' })
        toast.error('Kode tidak ditemukan atau kedaluwarsa.')
        setCode('')
      } else if (data.code === 'UNAUTHENTICATED') {
        setState({ kind: 'error', message: 'Sesi berakhir. Silakan masuk kembali.' })
        toast.error('Sesi berakhir. Silakan masuk kembali.')
        // Redirect to login after a short delay so the user can read the toast.
        setTimeout(() => navigate('/login'), 1500)
      } else {
        setState({ kind: 'error', message: data.error || 'Terjadi kesalahan' })
        toast.error(data.error || 'Terjadi kesalahan')
      }
    } catch {
      setState({ kind: 'error', message: 'Tidak dapat terhubung ke server.' })
      toast.error('Tidak dapat terhubung ke server.')
    }
  }

  // ---- Resend OTP (subject to 60s server-side cooldown) ----
  const handleResend = async () => {
    if (cooldownSeconds > 0 || resending) return
    setResending(true)
    try {
      const res = await fetch('/api/auth/verify-email/send-otp', {
        method: 'POST',
      })
      const data = await res.json()
      if (res.ok) {
        if (data.alreadyVerified) {
          setState({ kind: 'already_verified' })
          toast.success('Email Anda sudah terverifikasi.')
          return
        }
        if (data.sent) {
          toast.success('Kode verifikasi baru telah dikirim.')
          // Start the 60-second cooldown countdown.
          startCooldown(60)
        } else if (data.emailError) {
          toast.error('Gagal mengirim email. Coba lagi sebentar.')
          // Don't start the cooldown — the email didn't actually send.
        }
      } else if (res.status === 429 && data.code === 'RESEND_COOLDOWN') {
        // Server says cooldown is active. Start the countdown with the
        // server's retryAfterSeconds (rounded up by the server).
        const seconds = data.retryAfterSeconds || 60
        startCooldown(seconds)
        toast.error(`Terlalu sering mengirim. Coba lagi dalam ${seconds} detik.`)
      } else if (data.code === 'GOOGLE_USER_NO_VERIFICATION_NEEDED') {
        setState({ kind: 'already_verified' })
        toast.success('Akun Google — email sudah diverifikasi.')
      } else {
        toast.error(data.error || 'Gagal mengirim ulang kode.')
      }
    } catch {
      toast.error('Tidak dapat terhubung ke server.')
    } finally {
      setResending(false)
    }
  }

  // ---- Render ----
  // After successful verification, redirect to nextPath or /.
  useEffect(() => {
    if (state.kind === 'ok' || state.kind === 'already_verified') {
      const t = setTimeout(() => {
        navigate(nextPath || '/')
      }, 1200) // Short delay so the user sees the success state.
      return () => clearTimeout(t)
    }
  }, [state, navigate, nextPath])

  const userEmail = user?.email

  return (
    <div className="container-page flex min-h-[80vh] items-center justify-center py-10">
      <div className="w-full max-w-md">
        <Card className="p-6 sm:p-8">
          {/* Header */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MailCheck className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold sm:text-2xl">Verifikasi Email</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Masukkan 6-digit kode yang kami kirim ke
            </p>
            <p className="text-sm font-semibold text-foreground">{userEmail || 'email Anda'}</p>
          </div>

          {/* OK state — verification succeeded */}
          {state.kind === 'ok' && (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600" />
              <p className="text-sm text-muted-foreground">
                Email Anda berhasil diverifikasi. Mengalihkan...
              </p>
            </div>
          )}

          {/* Already verified state */}
          {state.kind === 'already_verified' && (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600" />
              <p className="text-sm text-muted-foreground">
                Email Anda sudah terverifikasi sebelumnya. Mengalihkan...
              </p>
            </div>
          )}

          {/* Already consumed state (race lost — idempotent success) */}
          {state.kind === 'already_consumed' && (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600" />
              <p className="text-sm text-muted-foreground">
                Kode sudah digunakan. Email Anda sudah terverifikasi.
              </p>
              <Button className="mt-4 w-full" onClick={() => navigate(nextPath || '/')}>
                Lanjutkan
              </Button>
            </div>
          )}

          {/* Not found / expired state — user must request a new OTP */}
          {state.kind === 'not_found_or_expired' && (
            <div className="text-center">
              <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
              <p className="text-sm text-muted-foreground">
                Kode verifikasi tidak ditemukan atau sudah kedaluwarsa.
              </p>
              <Button
                className="mt-4 w-full"
                onClick={handleResend}
                disabled={cooldownSeconds > 0 || resending}
              >
                {resending ? 'Mengirim...' : cooldownSeconds > 0 ? `Kirim ulang (${cooldownSeconds}s)` : 'Kirim kode baru'}
              </Button>
            </div>
          )}

          {/* Error state */}
          {state.kind === 'error' && (
            <div className="text-center">
              <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
              <p className="text-sm text-muted-foreground">{state.message}</p>
              <Button className="mt-4 w-full" variant="outline" onClick={() => setState({ kind: 'idle' })}>
                Coba lagi
              </Button>
            </div>
          )}

          {/* Idle / verifying / wrong_code state — show the OTP input form */}
          {(state.kind === 'idle' ||
            state.kind === 'verifying' ||
            state.kind === 'wrong_code') && (
            <>
              {/* OTP input — 6 single-digit slots */}
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={(v) => setCode(v)}
                  disabled={state.kind === 'verifying'}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {/* Wrong-code warning with remaining attempts */}
              {state.kind === 'wrong_code' && (
                <p className="mt-3 text-center text-xs text-destructive">
                  Kode salah. Sisa percobaan: {state.remainingAttempts}
                </p>
              )}

              {/* Submit button */}
              <Button
                className="mt-6 w-full"
                size="lg"
                onClick={handleVerify}
                disabled={code.length !== 6 || state.kind === 'verifying'}
              >
                {state.kind === 'verifying' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  'Verifikasi'
                )}
              </Button>

              {/* Resend button with cooldown countdown */}
              <div className="mt-4 flex flex-col items-center gap-2">
                <p className="text-xs text-muted-foreground">Tidak menerima kode?</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={handleResend}
                  disabled={cooldownSeconds > 0 || resending || state.kind === 'verifying'}
                >
                  {resending ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Mengirim...
                    </>
                  ) : cooldownSeconds > 0 ? (
                    <>
                      <RefreshCw className="h-3 w-3" />
                      Kirim ulang dalam {cooldownSeconds}s
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3" />
                      Kirim ulang kode
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Back to home link */}
          <div className="mt-6 flex items-center justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-muted-foreground"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-3 w-3" />
              Kembali ke beranda
            </Button>
          </div>
        </Card>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <MailCheck className="h-4 w-4" />
          <span>Anima Companion — Verified Identity V2</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// V1 link-token view (preserved for backward compat)
// ---------------------------------------------------------------------------

interface V1LinkTokenViewProps {
  token: string
  navigate: (path: string) => void
}

/**
 * V1LinkTokenView — preserved for backward compat. Already-issued V1 link
 * tokens (24h TTL) still consume via this path. New registrations use the
 * V2 OTP flow (V2OtpView above).
 *
 * The implementation is unchanged from Verified Identity V1 — it submits
 * the token to /api/auth/verify-email/confirm and shows the result.
 */
function V1LinkTokenView({ token, navigate }: V1LinkTokenViewProps) {
  const [state, setState] = useState<V1State>({ kind: 'verifying' })

  useEffect(() => {
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
          <span>Anima Companion — Verified Identity V1 (link token)</span>
        </div>
      </div>
    </div>
  )
}
