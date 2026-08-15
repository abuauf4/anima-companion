'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ShieldCheck,
  ShieldAlert,
  Plus,
  KeyRound,
  Power,
  PowerOff,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { PERMISSION_KEYS } from '@/lib/admin-permissions'

// ============================================================================
// AdminUsersView — Developer-only "Setting User Admin" management screen.
//
// FEATURES:
//   - List all AdminUser rows (username, displayName, systemRole, isActive,
//     mustChangePassword, lastLoginAt, permissions count).
//   - Create admin (username, displayName, temp password, initial permissions).
//   - Edit admin (display name, enable/disable).
//   - Reset password (new temp password → mustChangePassword=true,
//     sessionVersion++ → all existing sessions invalidated).
//   - Manage permissions (checkbox grid of all PERMISSION_KEYS).
//
// DEVELOPER PROTECTIONS (enforced server-side, mirrored in UI):
//   - Developer rows show a "Developer" badge and ALL action buttons are
//     DISABLED (no edit/reset/disable/permissions). The server rejects
//     these mutations with 403 anyway; the UI disabled state is a courtesy
//     so the Developer doesn't get error toasts when clicking.
//   - The create form has NO systemRole field — the server hardcodes
//     systemRole=ADMIN. A DEVELOPER can only be created via the env-var
//     bootstrap seed, never via this UI.
//
// SECURITY:
//   - The password hash is NEVER shown (the API never returns it).
//   - The temp password in the create form is shown only to the Developer
//     who is creating the account. It is the Developer's responsibility to
//     communicate it to the new admin out-of-band.
//   - All mutations require a valid DEVELOPER admin session (server-side
//     requireDeveloper). The UI hiding is a courtesy, NOT security.
// ============================================================================

interface AdminRow {
  id: string
  username: string
  displayName: string
  systemRole: 'DEVELOPER' | 'ADMIN'
  isActive: boolean
  mustChangePassword: boolean
  sessionVersion: number
  lastLoginAt: string | null
  createdAt: string
  permissions: string[]
}

export function AdminUsersView() {
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Gagal memuat daftar admin')
      }
      const data = await res.json()
      setAdmins(data.admins || [])
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : null) || 'Gagal memuat daftar admin')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Setting User Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola akun admin internal. Hanya Developer yang dapat mengakses halaman ini.
          </p>
        </div>
        <CreateAdminDialog onCreated={refresh} />
      </div>

      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">Memuat...</Card>
      ) : admins.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Belum ada admin. Buat admin pertama atau jalankan seed untuk bootstrap Developer.
        </Card>
      ) : (
        <div className="space-y-3">
          {admins.map((admin) => (
            <AdminRowCard key={admin.id} admin={admin} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// AdminRowCard — one row per admin with action buttons.
// ============================================================================

function AdminRowCard({ admin, onChanged }: { admin: AdminRow; onChanged: () => void }) {
  const isDeveloper = admin.systemRole === 'DEVELOPER'

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{admin.displayName}</span>
            {isDeveloper ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                <ShieldCheck className="h-3 w-3" /> Developer
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-xs font-semibold text-secondary">
                <Lock className="h-3 w-3" /> Admin
              </span>
            )}
            {!admin.isActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                <PowerOff className="h-3 w-3" /> Nonaktif
              </span>
            )}
            {admin.mustChangePassword && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <ShieldAlert className="h-3 w-3" /> Wajib ganti password
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            @{admin.username} · {admin.permissions.length} permission
            {admin.permissions.length !== 1 ? 's' : ''}
            {admin.lastLoginAt && (
              <> · Login terakhir: {new Date(admin.lastLoginAt).toLocaleString('id-ID')}</>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <EditAdminDialog admin={admin} disabled={isDeveloper} onChanged={onChanged} />
          <PermissionsDialog admin={admin} disabled={isDeveloper} onChanged={onChanged} />
          <ResetPasswordDialog admin={admin} disabled={isDeveloper} onDone={onChanged} />
          <ToggleActiveButton admin={admin} disabled={isDeveloper} onChanged={onChanged} />
        </div>
      </div>
    </Card>
  )
}

// ============================================================================
// CreateAdminDialog
// ============================================================================

function CreateAdminDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    password: '',
  })
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set())
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const togglePermission = (key: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.username || !form.displayName || !form.password) {
      toast.error('Semua field wajib diisi')
      return
    }
    if (form.password.length < 8) {
      toast.error('Password minimal 8 karakter')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          displayName: form.displayName,
          password: form.password,
          permissions: Array.from(selectedPermissions),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Admin ${data.admin.username} berhasil dibuat. Berikan password sementara secara aman.`)
      setForm({ username: '', displayName: '', password: '' })
      setSelectedPermissions(new Set())
      setOpen(false)
      onCreated()
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : null) || 'Gagal membuat admin')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Buat Admin
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Buat Admin Baru</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="new-username">Username</Label>
            <Input
              id="new-username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="username (minimal 3 karakter)"
              className="mt-1.5"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Username akan di-lowercase. Tidak dapat diubah setelah dibuat.
            </p>
          </div>
          <div>
            <Label htmlFor="new-display-name">Nama Tampilan</Label>
            <Input
              id="new-display-name"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="Nama lengkap admin"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="new-password">Password Sementara</Label>
            <div className="relative mt-1.5">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimal 8 karakter"
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Admin wajib mengganti password ini saat login pertama.
            </p>
          </div>
          <div>
            <Label>Permission Awal (opsional)</Label>
            <p className="mb-2 mt-1 text-xs text-muted-foreground">
              Developer bypass semua permission. Pilih permission untuk Admin ini.
            </p>
            <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-2">
              {PERMISSION_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedPermissions.has(key)}
                    onCheckedChange={() => togglePermission(key)}
                  />
                  <span className="font-mono text-xs">{key}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Memproses...' : 'Buat Admin'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// EditAdminDialog — edit display name + enable/disable
// ============================================================================

function EditAdminDialog({
  admin,
  disabled,
  onChanged,
}: {
  admin: AdminRow
  disabled: boolean
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState(admin.displayName)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      toast.error('Nama tidak boleh kosong')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${admin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Nama admin diperbarui')
      setOpen(false)
      onChanged()
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : null) || 'Gagal update admin')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Admin</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-username">Username</Label>
            <Input id="edit-username" value={admin.username} disabled className="mt-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">Username tidak dapat diubah.</p>
          </div>
          <div>
            <Label htmlFor="edit-display-name">Nama Tampilan</Label>
            <Input
              id="edit-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Memproses...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// PermissionsDialog — manage permission checkboxes
// ============================================================================

function PermissionsDialog({
  admin,
  disabled,
  onChanged,
}: {
  admin: AdminRow
  disabled: boolean
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set(admin.permissions))
  const [loading, setLoading] = useState(false)

  // Reset selection when dialog opens (sync with server state).
  useEffect(() => {
    if (open) setSelected(new Set(admin.permissions))
  }, [open, admin.permissions])

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${admin.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: Array.from(selected) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Permission diperbarui')
      setOpen(false)
      onChanged()
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : null) || 'Gagal update permission')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          Permission
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Permission: {admin.displayName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pilih permission untuk admin ini. Developer bypass semua permission.
          </p>
          <div className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
            {PERMISSION_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.has(key)}
                  onCheckedChange={() => toggle(key)}
                />
                <span className="font-mono text-xs">{key}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Memproses...' : 'Simpan Permission'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// ResetPasswordDialog
// ============================================================================

function ResetPasswordDialog({
  admin,
  disabled,
  onDone,
}: {
  admin: AdminRow
  disabled: boolean
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword) {
      toast.error('Password baru wajib diisi')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Password minimal 8 karakter')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${admin.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Password direset. Semua sesi admin ini telah diinvalidate.')
      setNewPassword('')
      setOpen(false)
      onDone()
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : null) || 'Gagal reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <KeyRound className="mr-1 h-3.5 w-3.5" /> Reset Password
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password: {admin.displayName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="reset-password">Password Sementara Baru</Label>
            <div className="relative mt-1.5">
              <Input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Admin wajib mengganti password ini saat login berikutnya. Semua sesi
              yang ada akan diinvalidate.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Memproses...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// ToggleActiveButton — enable/disable admin
// ============================================================================

function ToggleActiveButton({
  admin,
  disabled,
  onChanged,
}: {
  admin: AdminRow
  disabled: boolean
  onChanged: () => void
}) {
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${admin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !admin.isActive }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(admin.isActive ? 'Admin dinonaktifkan' : 'Admin diaktifkan kembali')
      onChanged()
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : null) || 'Gagal mengubah status admin')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={admin.isActive ? 'destructive' : 'default'}
      size="sm"
      disabled={disabled || loading}
      onClick={handleToggle}
    >
      {admin.isActive ? (
        <>
          <PowerOff className="mr-1 h-3.5 w-3.5" /> Nonaktifkan
        </>
      ) : (
        <>
          <Power className="mr-1 h-3.5 w-3.5" /> Aktifkan
        </>
      )}
    </Button>
  )
}
