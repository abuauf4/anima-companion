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
  MoreHorizontal,
  Users,
  Clock3,
} from 'lucide-react'
import { toast } from 'sonner'
import { AdminActionMenu, AdminEmptyState, AdminStatusBadge } from '@/components/admin/AdminListPrimitives'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

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

const PERMISSION_GROUPS = [
  { label: 'Dashboard', keys: ['dashboard.view'] },
  { label: 'Produk', keys: ['products.view', 'products.manage'] },
  { label: 'Kategori', keys: ['categories.view', 'categories.manage'] },
  { label: 'Pesanan', keys: ['orders.view', 'orders.manage'] },
  { label: 'Pelanggan', keys: ['customers.view', 'customers.export'] },
  { label: 'Banner', keys: ['banners.view', 'banners.manage'] },
  { label: 'Testimoni', keys: ['testimonials.view', 'testimonials.manage'] },
  { label: 'FAQ', keys: ['faqs.view', 'faqs.manage'] },
  { label: 'Voucher', keys: ['vouchers.view', 'vouchers.manage'] },
  { label: 'Pengaturan', keys: ['settings.view', 'settings.manage'] },
] as const

const permissionLabels: Record<string, string> = {
  'dashboard.view': 'Lihat',
  'products.view': 'Lihat', 'products.manage': 'Kelola',
  'categories.view': 'Lihat', 'categories.manage': 'Kelola',
  'orders.view': 'Lihat', 'orders.manage': 'Kelola',
  'customers.view': 'Lihat', 'customers.export': 'Export',
  'banners.view': 'Lihat', 'banners.manage': 'Kelola',
  'testimonials.view': 'Lihat', 'testimonials.manage': 'Kelola',
  'faqs.view': 'Lihat', 'faqs.manage': 'Kelola',
  'vouchers.view': 'Lihat', 'vouchers.manage': 'Kelola',
  'settings.view': 'Lihat', 'settings.manage': 'Kelola',
}

function formatLastLogin(value: string | null) {
  return value ? new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Belum pernah login'
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-4">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Developer control panel</p>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">User Admin</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">Kelola akun dan akses internal Anima Companion.</p>
        </div>
        <CreateAdminDialog onCreated={refresh} />
      </div>

      {loading ? (
        <div className="space-y-2" aria-label="Memuat daftar admin">
          {[1, 2].map((item) => <Card key={item} className="h-24 animate-pulse border-border/60 bg-muted/20 shadow-none" />)}
        </div>
      ) : admins.length === 0 ? (
        <AdminEmptyState icon={<Users className="h-6 w-6" />} title="Belum ada akun admin" description="Buat akun admin internal untuk membagi akses operasional Anima Companion." action={<CreateAdminDialog onCreated={refresh} />} />
      ) : (
        <div className="space-y-2.5">
          {admins.map((admin) => <AdminRowCard key={admin.id} admin={admin} onChanged={refresh} />)}
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
  const permissionSummary = isDeveloper
    ? 'Full system access'
    : admin.permissions.slice(0, 4).map((key) => key.split('.')[0]).filter((value, index, all) => all.indexOf(value) === index).map((value) => value.charAt(0).toUpperCase() + value.slice(1)).join(' • ') || 'Belum ada akses'

  const actions = isDeveloper ? [] : [
    { label: 'Edit admin', onSelect: () => document.getElementById(`edit-admin-${admin.id}`)?.click() },
    { label: 'Atur akses', onSelect: () => document.getElementById(`permissions-admin-${admin.id}`)?.click() },
    { label: 'Reset password', onSelect: () => document.getElementById(`reset-admin-${admin.id}`)?.click() },
    { label: admin.isActive ? 'Nonaktifkan' : 'Aktifkan', onSelect: () => document.getElementById(`toggle-admin-${admin.id}`)?.click(), destructive: admin.isActive },
  ]

  return (
    <Card className="border-border/70 p-3 shadow-none transition-colors hover:border-primary/30 hover:bg-muted/15 sm:p-4">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${isDeveloper ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
          {admin.displayName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">{admin.displayName}</p>
              <p className="truncate text-sm text-muted-foreground">@{admin.username}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {isDeveloper ? <AdminStatusBadge tone="info"><ShieldCheck className="mr-1 h-3 w-3" /> Developer</AdminStatusBadge> : <AdminStatusBadge tone="neutral"><Lock className="mr-1 h-3 w-3" /> Admin</AdminStatusBadge>}
              <span className="hidden sm:inline-flex"><AdminActionMenu items={actions} /></span>
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="mb-1 font-medium text-muted-foreground">Akses</p>
              <p className="truncate text-foreground">{permissionSummary}</p>
            </div>
            <div className="sm:text-right">
              <p className="mb-1 font-medium text-muted-foreground">Terakhir login</p>
              <p className="inline-flex items-center gap-1 text-foreground"><Clock3 className="h-3 w-3 text-muted-foreground" /> {formatLastLogin(admin.lastLoginAt)}</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <AdminStatusBadge tone={admin.isActive ? 'success' : 'danger'}>{admin.isActive ? 'Aktif' : 'Nonaktif'}</AdminStatusBadge>
            {admin.mustChangePassword && <AdminStatusBadge tone="warning"><ShieldAlert className="mr-1 h-3 w-3" /> Wajib ganti password</AdminStatusBadge>}
          </div>
        </div>
        {!isDeveloper && <div className="sm:hidden"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Aksi untuk ${admin.displayName}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{actions.map((action) => <DropdownMenuItem key={action.label} onSelect={action.onSelect} className={action.destructive ? 'text-destructive focus:text-destructive' : ''}>{action.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div>}
      </div>
      <div className="hidden"><EditAdminDialog admin={admin} disabled={isDeveloper} onChanged={onChanged} /><PermissionsDialog admin={admin} disabled={isDeveloper} onChanged={onChanged} /><ResetPasswordDialog admin={admin} disabled={isDeveloper} onDone={onChanged} /><ToggleActiveButton admin={admin} disabled={isDeveloper} onChanged={onChanged} /></div>
    </Card>
  )
}

function PermissionGroup({
  label,
  keys,
  selected,
  onToggle,
}: {
  label: string
  keys: readonly string[]
  selected: Set<string>
  onToggle: (key: string) => void
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background p-2.5">
      <p className="mb-2 text-xs font-semibold">{label}</p>
      <div className="space-y-1">
        {keys.map((key) => <label key={key} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-1.5 text-sm transition-colors hover:bg-muted/60">
          <Checkbox checked={selected.has(key)} onCheckedChange={() => onToggle(key)} />
          <span>{permissionLabels[key] || 'Akses'}</span>
        </label>)}
      </div>
    </div>
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
      <DialogContent className="max-h-[min(92vh,760px)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
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
          <div className="rounded-lg border border-border/70 bg-muted/10 p-3">
            <div className="mb-3 flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
              <div><p className="text-sm font-medium">Akses awal</p><p className="text-xs text-muted-foreground">Pilih area yang dapat dikelola admin ini.</p></div>
            </div>
            <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {PERMISSION_GROUPS.map((group) => <PermissionGroup key={group.label} label={group.label} keys={group.keys} selected={selectedPermissions} onToggle={togglePermission} />)}
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
        <Button id={`edit-admin-${admin.id}`} variant="outline" size="sm" disabled={disabled}>
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="p-4 sm:max-w-md sm:p-6">
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
        <Button id={`permissions-admin-${admin.id}`} variant="outline" size="sm" disabled={disabled}>
          Permission
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(92vh,760px)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle>Permission: {admin.displayName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pilih permission untuk admin ini. Developer bypass semua permission.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PERMISSION_GROUPS.map((group) => <PermissionGroup key={group.label} label={group.label} keys={group.keys} selected={selected} onToggle={toggle} />)}
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
        <Button id={`reset-admin-${admin.id}`} variant="outline" size="sm" disabled={disabled}>
          <KeyRound className="mr-1 h-3.5 w-3.5" /> Reset Password
        </Button>
      </DialogTrigger>
      <DialogContent className="p-4 sm:max-w-md sm:p-6">
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
    if (admin.isActive && !window.confirm(`Nonaktifkan akun ${admin.displayName}? Akun ini tidak dapat masuk sampai diaktifkan kembali.`)) return
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
      id={`toggle-admin-${admin.id}`}
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
