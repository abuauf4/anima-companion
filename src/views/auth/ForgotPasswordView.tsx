'use client'

import { useState, useRef } from 'react'
import { useHashRouter } from '@/lib/router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/auth/AuthShell'
import { Mail, ArrowLeft, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

/**
 * ForgotPasswordView — V2 forgot-password flow, stage 1 (request OTP).
 *
 * The user enters their email. We POST to /api/auth/forgot-password, which:
 *   - If the email exists + is a PASSWORD account: issues a PASSWORD_RESET
 *     OTP and emails it (subject to the 60s server-side resend cooldown).
 *   - If the email does NOT exist OR is a GOOGLE-only account: silently
 *     does nothing.
 *   - Always returns `{ sent: true }` (anti-enumeration — an attacker
 *     probing for valid emails can't distinguish the two cases from the
 *     response).
 *
 * After submitting, we show a "cek email" state regardless of whether the
 * email actually exists. If the user enters a non-existent email, they'll
 * wait for an OTP that never arrives — they can come back and try a
 * different email. This is the anti-enumeration UX tradeoff.
 *
 * Next step (stage 6): a separate /reset-password page where the user
 * enters the OTP + new password. This page only INITIATES the flow.
 *
 * Mobile-first:
 *   - Card max-width md (28rem) — fits mobile viewport.
 *   - Input is full-width with leading icon.
 *   - Buttons are full-width on mobile.
 *   - Resend button is disabled during cooldown; shows countdown.
 */
export function ForgotPasswordView() {
  const { navigate } = useHashRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCooldown = (seconds: number) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast.error('Email wajib diisi')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Format email tidak valid')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) {
        // Anti-enumeration: server always returns { sent: true } whether
        // or not the email exists. We show the "cek email" state either way.
        setSent(true)
        toast.success('Jika email terdaftar, kode reset password telah dikirim.')
        // Start the 60-second cooldown countdown so the user doesn't
        // spam the resend button.
        startCooldown(60)
      } else if (res.status === 429 && data.code === 'RESEND_COOLDOWN') {
        // Cooldown active — server says wait retryAfterSeconds.
        const seconds = data.retryAfterSeconds || 60
        startCooldown(seconds)
        toast.error(`Terlalu sering mengirim. Coba lagi dalam ${seconds} detik.`)
        // Don't set sent=true — the user hasn't successfully submitted yet.
      } else {
        toast.error(data.error || 'Gagal mengirim kode reset.')
      }
    } catch {
      toast.error('Tidak dapat terhubung ke server.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (cooldownSeconds > 0 || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Kode reset baru telah dikirim (jika email terdaftar).')
        startCooldown(60)
      } else if (res.status === 429 && data.code === 'RESEND_COOLDOWN') {
        const seconds = data.retryAfterSeconds || 60
        startCooldown(seconds)
        toast.error(`Terlalu sering mengirim. Coba lagi dalam ${seconds} detik.`)
      } else {
        toast.error(data.error || 'Gagal mengirim ulang kode.')
      }
    } catch {
      toast.error('Tidak dapat terhubung ke server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Lupa password"
      description="Masukkan email Anda dan kami akan mengirim kode reset password."
      footer={(
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Ingat password Anda?{' '}
          <button onClick={() => navigate('/login')} className="font-semibold text-primary hover:underline">Masuk</button>
        </p>
      )}
    >
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="pl-9"
                    autoComplete="email"
                    autoFocus
                    disabled={loading}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  'Kirim Kode Reset'
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
              <div>
                <p className="text-sm font-medium">Cek email Anda</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Jika <span className="font-semibold text-foreground">{email}</span> terdaftar,
                  kode reset password telah dikirim. Kode berlaku 10 menit.
                </p>
              </div>

              {/* Resend button with cooldown countdown */}
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-muted-foreground">Tidak menerima kode?</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={handleResend}
                  disabled={cooldownSeconds > 0 || loading}
                >
                  {loading ? (
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

              {/* Link to /reset-password — stage 6 ships the reset-password page
                  where the user enters the OTP + new password. The user can
                  navigate there directly once they have the OTP code (e.g. they
                  closed the tab and came back, or they want to re-use a code
                  that was sent earlier and is still within the 10-min TTL). */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/reset-password')}
              >
                Saya sudah punya kode — masukkan di sini
              </Button>
            </div>
          )}

          <div className="mt-4 flex items-center justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-muted-foreground"
              onClick={() => navigate('/login')}
            >
              <ArrowLeft className="h-3 w-3" />
              Kembali ke login
            </Button>
          </div>
        </AuthShell>
  )
}
