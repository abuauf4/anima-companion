'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Search, Users, Mail, Phone, PawPrint, ShoppingBag, Download,
  ShieldCheck, ShieldAlert, CheckCircle2, Loader2,
} from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/format'

// ============================================================================
// Member Registry — admin view.
// Extends the existing CustomersView with:
//   - Verification badge (Verified / Unverified)
//   - Provider badge (Google / Email)
//   - Filter dropdowns: verification, provider, role
//   - Export CSV button (respects current filters)
//   - Mobile-first cards on small screens, table on md+ screens
//   - Member detail dialog showing provider, emailVerifiedAt, role
//   - Read-only on sensitive fields (no inline edit of emailVerifiedAt /
//     provider / providerSubject / role from the admin UI)
// ============================================================================

interface Member {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  provider: string
  emailVerifiedAt: string | null
  emailVerified: boolean
  createdAt: string
  totalOrders: number
  lastOrderAt: string | null
}

interface MemberDetail extends Member {
  updatedAt: string
  orders: Array<{
    id: string
    orderNumber: string
    total: number
    status: string
    createdAt: string
  }>
}

interface MemberListResponse {
  members: Member[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters: {
    search: string
    verified: string | null
    provider: string | null
    role: string | null
  }
}

type VerifiedFilter = '' | 'true' | 'false'
type ProviderFilter = '' | 'PASSWORD' | 'GOOGLE'
type RoleFilter = '' | 'CUSTOMER' | 'ADMIN' | 'SELLER'

export function CustomersView() {
  const [members, setMembers] = useState<Member[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const [search, setSearch] = useState('')
  const [verified, setVerified] = useState<VerifiedFilter>('')
  const [provider, setProvider] = useState<ProviderFilter>('')
  const [role, setRole] = useState<RoleFilter>('')

  const [selected, setSelected] = useState<MemberDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (verified) params.set('verified', verified)
    if (provider) params.set('provider', provider)
    if (role) params.set('role', role)
    params.set('page', '1')
    params.set('limit', '20')

    try {
      const res = await fetch(`/api/admin/customers?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load members')
      const data: MemberListResponse = await res.json()
      setMembers(data.members || [])
      setPagination(data.pagination)
    } catch {
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [search, verified, provider, role])

  useEffect(() => {
    load()
  }, [load])

  const openDetail = async (m: Member) => {
    setDetailLoading(true)
    setSelected(null)
    try {
      const res = await fetch(`/api/admin/customers/${m.id}`)
      if (!res.ok) throw new Error('Failed to load detail')
      const data = await res.json()
      setSelected(data.member)
    } catch {
      setSelected(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (verified) params.set('verified', verified)
      if (provider) params.set('provider', provider)
      if (role) params.set('role', role)
      const res = await fetch(`/api/admin/customers/export?${params.toString()}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      // Extract filename from Content-Disposition (fallback to a default).
      const cd = res.headers.get('Content-Disposition') || ''
      const fm = cd.match(/filename="([^"]+)"/)
      const filename = fm ? fm[1] : `anima-members_${new Date().toISOString().slice(0, 10)}.csv`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // Silent — admin will see the table didn't change. Production logs
      // go through logAuthError on the server side.
    } finally {
      setExporting(false)
    }
  }

  const hasActiveFilters = !!(search || verified || provider || role)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Member</h1>
          <p className="text-sm text-muted-foreground">
            Registry member terverifikasi — {pagination.total} member
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting || pagination.total === 0}
          className="gap-2"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export CSV
        </Button>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            load()
          }}
        >
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nama, email, telepon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </form>

        <div className="flex flex-wrap gap-2">
          <FilterSelect
            label="Verifikasi"
            value={verified}
            onChange={(v) => setVerified(v as VerifiedFilter)}
            options={[
              { value: '', label: 'Semua' },
              { value: 'true', label: 'Terverifikasi' },
              { value: 'false', label: 'Belum terverifikasi' },
            ]}
          />
          <FilterSelect
            label="Provider"
            value={provider}
            onChange={(v) => setProvider(v as ProviderFilter)}
            options={[
              { value: '', label: 'Semua' },
              { value: 'PASSWORD', label: 'Email/Password' },
              { value: 'GOOGLE', label: 'Google' },
            ]}
          />
          <FilterSelect
            label="Role"
            value={role}
            onChange={(v) => setRole(v as RoleFilter)}
            options={[
              { value: '', label: 'Semua' },
              { value: 'CUSTOMER', label: 'Customer' },
              { value: 'SELLER', label: 'Seller' },
              { value: 'ADMIN', label: 'Admin' },
            ]}
          />
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                setVerified('')
                setProvider('')
                setRole('')
              }}
              className="text-xs"
            >
              Reset filter
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <Card className="p-4">
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </Card>
      ) : members.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-sm font-medium">
            {hasActiveFilters ? 'Tidak ada member yang cocok dengan filter' : 'Belum ada member'}
          </p>
        </Card>
      ) : (
        <>
          {/* Desktop table — md+ */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-accent/50">
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Member</th>
                    <th className="px-4 py-3 font-medium">Kontak</th>
                    <th className="px-4 py-3 font-medium">Provider</th>
                    <th className="px-4 py-3 font-medium">Verifikasi</th>
                    <th className="px-4 py-3 font-medium">Bergabung</th>
                    <th className="px-4 py-3 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-t border-border hover:bg-accent/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full gradient-brand text-white text-sm font-bold">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{m.name}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">
                              {m.id.slice(0, 12)}…
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs">{m.email}</p>
                        <p className="text-xs text-muted-foreground">{m.phone || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <ProviderBadge provider={m.provider} />
                      </td>
                      <td className="px-4 py-3">
                        <VerificationBadge verified={m.emailVerified} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(m.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDetail(m)}
                        >
                          Detail
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards — below md */}
          <div className="space-y-3 md:hidden">
            {members.map((m) => (
              <Card key={m.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full gradient-brand text-white text-sm font-bold">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{m.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      <p className="text-xs text-muted-foreground">{m.phone || '-'}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDetail(m)}
                  >
                    Detail
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ProviderBadge provider={m.provider} />
                  <VerificationBadge verified={m.emailVerified} />
                  <Badge variant="outline" className="text-[10px]">
                    {formatDate(m.createdAt)}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination (simple prev/next) */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled
              >
                Halaman {pagination.page} / {pagination.totalPages}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Detail dialog */}
      <Dialog
        open={!!selected || detailLoading}
        onOpenChange={(v) => !v && setSelected(null)}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selected ? (
            <>
              <DialogHeader>
                <DialogTitle>Detail Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full gradient-brand text-white text-2xl font-bold">
                    {selected.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold">{selected.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <ProviderBadge provider={selected.provider} />
                      <VerificationBadge verified={selected.emailVerified} />
                      <Badge variant="outline" className="text-[10px]">
                        {selected.role}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Bergabung sejak {formatDate(selected.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Total Pesanan</p>
                    <p className="text-xl font-bold text-primary">{selected.orders.length}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Pesanan Terakhir</p>
                    <p className="text-sm font-medium">
                      {selected.orders[0]
                        ? formatDate(selected.orders[0].createdAt)
                        : 'Belum ada pesanan'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Kontak</p>
                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" /> {selected.email}
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" /> {selected.phone || '-'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                    Identitas
                  </p>
                  <div className="space-y-2 text-sm">
                    <DetailRow label="Provider" value={providerLabel(selected.provider)} />
                    <DetailRow
                      label="Email terverifikasi"
                      value={
                        selected.emailVerified
                          ? `Ya (${formatDate(selected.emailVerifiedAt!)})`
                          : 'Belum'
                      }
                    />
                    <DetailRow label="Role" value={selected.role} />
                    <DetailRow
                      label="User ID"
                      value={selected.id}
                      mono
                    />
                    <DetailRow
                      label="Tanggal daftar"
                      value={formatDate(selected.createdAt)}
                    />
                    <DetailRow
                      label="Terakhir diperbarui"
                      value={formatDate(selected.updatedAt)}
                    />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Catatan: emailVerifiedAt, provider, providerSubject, dan role
                    tidak dapat diubah dari admin UI — perubahan identitas
                    hanya melalui flow verifikasi resmi.
                  </p>
                </div>

                {selected.orders.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                      Riwayat Pesanan (5 terakhir)
                    </p>
                    <div className="space-y-2">
                      {selected.orders.map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between text-sm border-b border-border/60 pb-2"
                        >
                          <div>
                            <p className="font-mono text-xs">{o.orderNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(o.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatRupiah(o.total)}</p>
                            <Badge variant="outline" className="text-[9px]">
                              {o.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ----- Helper sub-components -----

function VerificationBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        <ShieldCheck className="h-3 w-3" />
        Verified
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <ShieldAlert className="h-3 w-3" />
      Unverified
    </Badge>
  )
}

function ProviderBadge({ provider }: { provider: string }) {
  if (provider === 'GOOGLE') {
    return (
      <Badge variant="outline" className="gap-1 text-[10px]">
        <CheckCircle2 className="h-3 w-3 text-blue-500" />
        Google
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px]">
      Email
    </Badge>
  )
}

function providerLabel(provider: string): string {
  if (provider === 'GOOGLE') return 'Google'
  if (provider === 'PASSWORD') return 'Email / Password'
  return provider
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-right text-sm font-medium ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  )
}

// FilterSelect — a simple <select> styled to match the existing UI.
// We use a native select for mobile-friendliness (touch-friendly dropdown)
// rather than a custom popover.
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
