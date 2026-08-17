'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { User, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

// ============================================================================
// AdminLoginView — Internal admin login form.
//
// Visual language matches the customer LoginView (same Card / Input / Button
// / toast / container-page / gradient-brand badge) so the admin panel feels
// like the same product. DIFFERENCES from customer login:
//   - Username field (NOT email)
//   - No Google OAuth button
//   - No "Lupa password?" link (admin password resets are done by the
//     Developer via the Setting User Admin menu — there is no public
//     password-reset flow for the admin realm)
//   - No "Daftar sekarang" link (admin accounts are created by the
//     Developer; there is no public registration)
//   - Button label: "Masuk Admin"
//   - A small "Internal admin only" badge distinguishes this page from
//     the customer login so operators don't confuse the two realms.
//
// POST-LOGIN REDIRECT:
//   - mustChangePassword === true  → /admin/change-password
//   - mustChangePassword === false → ?next= (if safe internal /admin path)
//                                    else /admin
//
// OPEN-REDIRECT DEFENSE:
//   The `next` prop is received from the server component, which received it
//   from the URL search param. We ONLY honor it if it starts with `/admin`
//   (so a customer path like `/checkout` can't be injected). The server
//   component already did this check before passing it down; we re-check
//   here as defense-in-depth.
// ============================================================================

function safeAdminNext(next: unknown): string | null {
  if (typeof next !== 'string') return null
  if (!next.startsWith('/admin')) return null
  if (next.startsWith('//')) return null
  if (next.startsWith('/\\')) return null
  return next
}

export function AdminLoginView({ next }: { next?: string }) {
  const router = useRouter()
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.username || !form.password) {
      toast.error('Username dan password wajib diisi')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Decide post-login destination.
      if (data.user.mustChangePassword) {
        toast.success('Login berhasil. Silakan ganti password Anda.')
        router.push('/admin/change-password')
        return
      }

      toast.success(`Selamat datang, ${data.user.displayName}!`)
      const safeNext = safeAdminNext(next)
      router.push(safeNext ?? '/admin')
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : null) || 'Gagal masuk')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login-page flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-[420px]">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-foreground text-background">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">ANIMA · ADMIN CONSOLE</p>
          <h1 className="mt-2 text-2xl font-bold">Masuk ke panel internal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Login khusus admin internal
          </p>
        </div>

        <Card className="border-border/70 p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <div className="relative mt-1.5">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="username admin"
                  className="pl-9"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
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
                  className="px-9"
                  autoComplete="current-password"
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

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Memproses...
                </>
              ) : (
                'Masuk Admin'
              )}
            </Button>
          </form>

          <div className="mt-4 rounded-lg border border-border bg-accent/30 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Akun admin dibuat oleh Developer. Hubungi Developer jika Anda
              lupa password atau belum memiliki akun admin.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
