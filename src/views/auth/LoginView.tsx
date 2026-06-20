'use client'

import { useState } from 'react'
import { useHashRouter } from '@/lib/router'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Mail, Lock, Eye, EyeOff, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { SITE_CONFIG } from '@/lib/config'

export function LoginView() {
  const { navigate } = useHashRouter()
  const { refresh } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

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
      toast.success(`Selamat datang, ${data.user.name}!`)
      await refresh()
      if (data.user.role === 'ADMIN') {
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
    <div className="container-page flex min-h-[80vh] items-center justify-center py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl gradient-brand text-white text-xl font-bold">
            A
          </div>
          <h1 className="text-2xl font-bold">Masuk ke Akun Anda</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Selamat datang kembali di Anima Companion
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="pl-9"
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
                'Masuk'
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Belum punya akun?{' '}
            <button onClick={() => navigate('/register')} className="font-medium text-primary hover:underline">
              Daftar sekarang
            </button>
          </p>
        </Card>

        {/* Demo credentials */}
        <Card className="mt-4 bg-accent/50 p-4">
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
        </Card>
      </div>
    </div>
  )
}
