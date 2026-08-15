'use client'

import { useState, useRef } from 'react'
import { useHashRouter } from '@/lib/router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Lock, ArrowLeft, Loader2, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

/**
 * ResetPasswordView — V2 reset-password flow.
 *
 * Stage 6 (this stage): OTP verification + reset grant issuance.
 *   - User enters their email + the 6-digit OTP they received.
 *   - We POST to /api/auth/reset-password/verify-otp.
 *   - On OK, the server returns a `grant` (32-byte hex string) which we
 *     store in component state.
 *   - The UI then transitions to the "new password" step (stage 7 will
 *     wire the actual reset-password call).
 *
 * Stage 7 (next stage): new password submission.
 *   - User enters new password + confirm.
 *   - We POST to /api/auth/reset-password with `{ grant, newPassword }`.
 *   - On OK: the password is updated (bcrypt), sessionVersion is bumped
 *     (invalidating all prior sessions), and the user is redirected to
 *     /login to log in with the new password.
 *
 * For now (stage 6), the new password form is rendered but the submit
 * handler shows a "coming in stage 7" toast. This keeps the UI testable
 * for stage 6 without depending on stage 7's route.
 *
 * ANTI-ENUMERATION UX:
 *   - On NOT_FOUND_OR_EXPIRED: show "kode tidak ditemukan atau kedaluwarsa".
 *     This is the same message the server returns for non-existent emails
 *     + GOOGLE accounts + actual expired OTPs — the user can't tell which.
 *   - On WRONG_CODE: show "kode salah, sisa percobaan: N". This is a
 *     minor enumeration vector (see route docstring) but is necessary
 *     for UX.
 *
 * Mobile-first:
 *   - Card max-w-md.
 *   - OTP slots h-12 w-12 (touch-friendly).
 *   - Inputs full-width with leading icons.
 *   - Buttons full-width.
 */
type Step = 'otp' | 'newPassword' | 'success' | 'error'

export function ResetPasswordView() {
  const { navigate } = useHashRouter()
  const [step, setStep] = useState<Step>('otp')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [grant, setGrant] = useState<string | null>(null)
  // Track remaining OTP attempts for the UI display.
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null)

  // ---- Step 1: verify the OTP and obtain a reset grant ----
  const handleVerifyOtp = async () => {
    if (!email) {
      toast.error('Email wajib diisi')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Format email tidak valid')
      return
    }
    if (code.length !== 6) {
      toast.error('Kode reset harus 6 digit')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (data.code === 'OK') {
        setGrant(data.grant)
        setStep('newPassword')
        toast.success('Kode terverifikasi. Silakan masukkan password baru.')
      } else if (data.code === 'ALREADY_CONSUMED') {
        toast.error('Kode sudah digunakan. Silakan minta kode baru.')
        setCode('')
      } else if (data.code === 'WRONG_CODE') {
        setRemainingAttempts(data.remainingAttempts)
        toast.error(`Kode salah. Sisa percobaan: ${data.remainingAttempts}`)
        setCode('')
      } else if (data.code === 'NOT_FOUND_OR_EXPIRED') {
        toast.error('Kode tidak ditemukan atau kedaluwarsa. Silakan minta kode baru.')
        setCode('')
      } else {
        toast.error(data.error || 'Terjadi kesalahan')
      }
    } catch {
      toast.error('Tidak dapat terhubung ke server.')
    } finally {
      setLoading(false)
    }
  }

  // ---- Step 2: submit the new password with the grant ----
  // NOTE: stage 7 will implement the /api/auth/reset-password route.
  // For stage 6, this handler shows a "coming soon" toast so the UI is
  // testable without depending on stage 7.
  const handleResetPassword = async () => {
    if (!grant) {
      toast.error('Sesi reset tidak valid. Silakan mulai ulang.')
      setStep('otp')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Password minimal 6 karakter')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi password tidak cocok')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant, newPassword }),
      })
      const data = await res.json()
      if (data.code === 'OK') {
        setStep('success')
        toast.success('Password berhasil diubah. Silakan masuk dengan password baru.')
      } else if (data.code === 'GRANT_EXPIRED') {
        toast.error('Sesi reset kedaluwarsa. Silakan minta kode baru.')
        setStep('otp')
        setGrant(null)
        setCode('')
        setNewPassword('')
        setConfirmPassword('')
      } else if (data.code === 'GRANT_CONSUMED') {
        toast.error('Sesi reset sudah digunakan. Silakan minta kode baru.')
        setStep('otp')
        setGrant(null)
        setCode('')
        setNewPassword('')
        setConfirmPassword('')
      } else if (data.code === 'PASSWORD_TOO_SHORT') {
        toast.error('Password minimal 6 karakter')
      } else {
        toast.error(data.error || 'Gagal mengubah password.')
      }
    } catch {
      toast.error('Tidak dapat terhubung ke server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container-page flex min-h-[80vh] items-center justify-center py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl gradient-brand text-white text-xl font-bold">
            A
          </div>
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === 'otp'
              ? 'Masukkan email + kode reset yang kami kirim'
              : step === 'newPassword'
              ? 'Masukkan password baru Anda'
              : step === 'success'
              ? 'Password berhasil diubah'
              : 'Terjadi kesalahan'}
          </p>
        </div>

        <Card className="p-6">
          {/* Step 1: OTP verification */}
          {step === 'otp' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="px-3"
                    autoComplete="email"
                    autoFocus
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="otp">Kode Reset (6 digit)</Label>
                <div className="mt-1.5 flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={(v) => setCode(v)}
                    disabled={loading}
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
                {remainingAttempts !== null && (
                  <p className="mt-2 text-center text-xs text-destructive">
                    Sisa percobaan: {remainingAttempts}
                  </p>
                )}
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleVerifyOtp}
                disabled={loading || code.length !== 6 || !email}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  'Verifikasi Kode'
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-xs text-muted-foreground hover:text-primary hover:underline"
                >
                  Belum menerima kode? Kirim ulang
                </button>
              </div>
            </div>
          )}

          {/* Step 2: new password */}
          {step === 'newPassword' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="newPassword">Password Baru</Label>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 karakter"
                    className="px-9"
                    autoComplete="new-password"
                    autoFocus
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    className="px-9"
                    autoComplete="new-password"
                    disabled={loading}
                  />
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleResetPassword}
                disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mengubah password...
                  </>
                ) : (
                  'Ubah Password'
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep('otp')
                    setGrant(null)
                    setCode('')
                    setNewPassword('')
                    setConfirmPassword('')
                  }}
                  className="text-xs text-muted-foreground hover:text-primary hover:underline"
                >
                  Kembali ke verifikasi kode
                </button>
              </div>
            </div>
          )}

          {/* Step 3: success */}
          {step === 'success' && (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
              <div>
                <p className="text-sm font-medium">Password berhasil diubah</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Semua sesi sebelumnya telah diakhiri. Silakan masuk dengan password baru Anda.
                </p>
              </div>
              <Button className="w-full" onClick={() => navigate('/login')}>
                Masuk dengan Password Baru
              </Button>
            </div>
          )}
        </Card>

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
      </div>
    </div>
  )
}
