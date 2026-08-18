'use client'

import { useState } from 'react'
import { useHashRouter } from '@/lib/router'
import { safeInternalPath } from '@/lib/redirect'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { AuthShell } from '@/components/auth/AuthShell'

// Demo-credential helpers are only available when Next.js is running in
// development mode. In production builds, `process.env.NODE_ENV === 'production'`
// is inlined at build time, and the entire demo-credentials Card is excluded
// from the bundle by the dead-code-elimination pass. This guarantees that
// `admin@anima.id`, `budi@example.com`, `admin123`, and `customer123` can
// never appear in the production client bundle.
const SHOW_DEMO_CREDENTIALS = process.env.NODE_ENV !== 'production'

export function LoginView() {
  const { route, navigate } = useHashRouter()
  const { refresh } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // Honor ?next=... so users returning from /checkout land back on the page
  // they came from after a successful login. Defaults to home or admin.
  //
  // OPEN-REDIRECT DEFENSE: `safeInternalPath` rejects any `next` value that
  // is not a safe internal application path. Specifically, it rejects:
  //   - missing / empty values
  //   - external URLs (`https://evil.example.com`)
  //   - scheme-relative URLs (`//evil.example.com`)
  //   - backslash-prefixed variants (`/\evil.example.com`)
  //   - scheme URLs (`javascript:alert(1)`, `data:text/html,...`)
  // If `next` is rejected, we fall through to the role-based default below.
  const nextPath = safeInternalPath(route.query.get('next'))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      toast.error('Email dan password wajib diisi')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await refresh()
      // Account Recovery & Verification V2:
      // If the server says the user must verify their email, redirect them
      // to /verify-email BEFORE honoring ?next= or the role-based default.
      // The user is logged in (session cookie is set) but their email is
      // unverified — they must enter the OTP we just emailed before they
      // can proceed.
      //
      // We preserve the original ?next= as ?next= on the /verify-email URL
      // so the verify-email page can redirect there after successful
      // verification.
      if (data.requiresVerification) {
        if (data.otpSent) {
          toast.success(`Kode verifikasi telah dikirim ke ${data.user.email}.`)
        } else {
          toast.success(`Anda harus verifikasi email. Klik "Kirim ulang" untuk menerima kode.`)
        }
        const verifyUrl = nextPath
          ? `/verify-email?next=${encodeURIComponent(nextPath)}`
          : '/verify-email'
        navigate(verifyUrl)
        return
      }
      toast.success(`Selamat datang, ${data.user.name}!`)
      // If a safe internal ?next= target was set (e.g. /checkout), go there.
      // Otherwise admins go to /admin and customers go to /.
      // safeInternalPath already rejected anything external or malformed.
      if (nextPath) {
        navigate(nextPath)
      } else if (data.user.role === 'ADMIN') {
        navigate('/admin')
      } else {
        navigate('/')
      }
    } catch (e: any) {
      toast.error(e.message || 'Gagal masuk')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (type: 'admin' | 'customer') => {
    if (type === 'admin') {
      setForm({ email: 'admin@anima.id', password: 'admin123' })
    } else {
      setForm({ email: 'budi@example.com', password: 'customer123' })
    }
  }

  return (
    <AuthShell
      title="Selamat datang kembali 👋"
      description="Temani kebutuhan anabulmu bersama Anima Companion."
      surface={false}
      footer={(
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Belum punya akun?{' '}
          <button onClick={() => navigate('/register')} className="font-semibold text-primary hover:underline">
            Daftar
          </button>
        </p>
      )}
    >
          {/* Google remains the clearest path, while staying part of the same editorial flow. */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-card/75 p-1 shadow-[0_10px_30px_-24px_oklch(0.18_0.02_30_/_0.35)] ring-1 ring-primary/10 transition hover:ring-primary/25">
              <GoogleSignInButton label="Lanjutkan dengan Google" />
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/70" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[oklch(0.99_0.002_80)] px-3 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">atau masuk dengan email</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="nama@email.com"
                  className="h-12 rounded-xl border-border/80 bg-card/70 pl-10 shadow-none transition placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-primary/20"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Masukkan password"
                  className="h-12 rounded-xl border-border/80 bg-card/70 px-10 shadow-none transition placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-primary/20"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Forgot password link — V2 stage 5. Routes to /forgot-password
                where the user enters their email to receive a PASSWORD_RESET
                OTP. Anti-enumeration: the server always returns { sent: true }
                whether or not the email exists. */}
            <div className="-mt-1 flex justify-end">
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-xs text-muted-foreground hover:text-primary hover:underline"
              >
                Lupa password?
              </button>
            </div>

            <Button type="submit" className="mt-2 h-12 w-full rounded-xl bg-primary text-primary-foreground shadow-[0_10px_24px_-16px_var(--primary)] transition hover:bg-primary/90 hover:shadow-[0_12px_28px_-16px_var(--primary)] focus-visible:ring-primary/30" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Memproses...
                </>
              ) : (
                'Masuk'
              )}
            </Button>
          </form>

        {/* Demo credentials — DEVELOPMENT ONLY.
            Gated by process.env.NODE_ENV (inlined at build time). In production
            builds, SHOW_DEMO_CREDENTIALS is `false` and this entire block is
            tree-shaken out of the client bundle, so the demo email/password
            strings can never appear in production. */}
        {SHOW_DEMO_CREDENTIALS && (
          <div className="mt-4 rounded-xl border border-dashed border-border/80 bg-card/60 p-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Akun Demo (klik untuk isi otomatis):</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => fillDemo('admin')}
                className="rounded-lg border border-border bg-card p-2.5 text-left text-xs hover:border-primary/30"
              >
                <p className="font-semibold text-primary">Admin</p>
                <p className="text-muted-foreground">admin@anima.id</p>
              </button>
              <button
                onClick={() => fillDemo('customer')}
                className="rounded-lg border border-border bg-card p-2.5 text-left text-xs hover:border-primary/30"
              >
                <p className="font-semibold text-secondary">Customer</p>
                <p className="text-muted-foreground">budi@example.com</p>
              </button>
            </div>
          </div>
        )}
    </AuthShell>
  )
}
