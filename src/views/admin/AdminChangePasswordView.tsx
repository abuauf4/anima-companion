'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Lock, Eye, EyeOff, ShieldAlert, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

// ============================================================================
// AdminChangePasswordView — Own-password change form.
//
// Fields: currentPassword, newPassword, confirmPassword.
// (There is NO "view current password" feature — passwordHash is never
//  returned by any API. The admin must know their current password to
//  change it; if they forgot it, only the Developer can reset it.)
//
// POST /api/admin/auth/change-password:
//   - Verifies currentPassword against the stored bcrypt hash.
//   - Validates newPassword === confirmPassword, >= 8 chars, !== current.
//   - Replaces passwordHash, sets mustChangePassword=false, bumps
//     sessionVersion (invalidates all other sessions).
//   - Re-issues the current session cookie with the new sessionVersion.
//
// AFTER SUCCESS:
//   - If mustChangePassword was true (forced first-login change) → go to /admin
//   - If mustChangePassword was false (voluntary change) → go back to /admin
//   In both cases the destination is /admin. We just show a different toast.
// ============================================================================

const MIN_PASSWORD_LENGTH = 8

export function AdminChangePasswordView({
  mustChangePassword,
  displayName,
}: {
  mustChangePassword: boolean
  displayName: string
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      toast.error('Semua field wajib diisi')
      return
    }
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Password baru dan konfirmasi tidak cocok')
      return
    }
    if (form.newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password baru minimal ${MIN_PASSWORD_LENGTH} karakter`)
      return
    }
    if (form.newPassword === form.currentPassword) {
      toast.error('Password baru tidak boleh sama dengan password lama')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success('Password berhasil diganti.')
      // Both forced-change and voluntary-change land on /admin after success.
      router.push('/admin')
      router.refresh()
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : null) || 'Gagal ganti password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container-page flex min-h-[80vh] items-center justify-center py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl gradient-brand text-white">
            {mustChangePassword ? <ShieldAlert className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
          </div>
          <h1 className="text-2xl font-bold">
            {mustChangePassword ? 'Ganti Password Wajib' : 'Ganti Password'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mustChangePassword
              ? `Akun ${displayName} menggunakan password sementara. Silakan ganti sebelum melanjutkan.`
              : `Ganti password akun ${displayName}.`}
          </p>
        </div>

        {mustChangePassword && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
            <p className="text-sm font-medium">
              Password Anda belum diganti dari password sementara yang
              diberikan Developer. Anda tidak dapat mengakses panel admin
              sebelum mengganti password.
            </p>
          </div>
        )}

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Password Saat Ini</Label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="currentPassword"
                  type={showCurrent ? 'text' : 'password'}
                  value={form.currentPassword}
                  onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                  placeholder="Masukkan password saat ini"
                  className="px-9"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="newPassword">Password Baru</Label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  value={form.newPassword}
                  onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                  placeholder="Minimal 8 karakter"
                  className="px-9"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showNew ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="Ulangi password baru"
                  className="px-9"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Memproses...
                </>
              ) : (
                'Ganti Password'
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
