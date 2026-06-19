'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Search, Users, Mail, Phone, PawPrint, ShoppingBag } from 'lucide-react'
import { formatRupiah, formatDate } from '@/lib/format'

interface Customer {
  id: string
  name: string
  email: string
  phone: string | null
  createdAt: string
  orders: Array<{ id: string; total: number; status: string; createdAt: string }>
  petProfiles: Array<{ id: string; petName: string; petType: { name: string } }>
  totalOrders: number
  totalSpent: number
}

export function CustomersView() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)

  const load = async (q = '') => {
    setLoading(true)
    const res = await fetch(`/api/admin/customers?search=${encodeURIComponent(q)}`)
    const data = await res.json()
    setCustomers(data.customers || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pelanggan</h1>
        <p className="text-sm text-muted-foreground">Daftar pelanggan terdaftar</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); load(search) }}>
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

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-sm font-medium">Belum ada pelanggan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-accent/50">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium">Kontak</th>
                  <th className="px-4 py-3 font-medium">Bergabung</th>
                  <th className="px-4 py-3 font-medium">Pesanan</th>
                  <th className="px-4 py-3 font-medium">Total Belanja</th>
                  <th className="px-4 py-3 font-medium">Hewan</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-accent/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full gradient-brand text-white text-sm font-bold">
                          {c.name.charAt(0)}
                        </div>
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs">{c.email}</p>
                      <p className="text-xs text-muted-foreground">{c.phone || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{c.totalOrders}</Badge>
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatRupiah(c.totalSpent)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px]">{c.petProfiles.length} hewan</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelected(c)}>
                        Detail
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Detail Pelanggan</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full gradient-brand text-white text-2xl font-bold">
                    {selected.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{selected.name}</h3>
                    <p className="text-sm text-muted-foreground">Bergabung sejak {formatDate(selected.createdAt)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Total Pesanan</p>
                    <p className="text-xl font-bold text-primary">{selected.totalOrders}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Total Belanja</p>
                    <p className="text-xl font-bold text-primary">{formatRupiah(selected.totalSpent)}</p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Kontak</p>
                  <div className="space-y-1 text-sm">
                    <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {selected.email}</p>
                    <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {selected.phone || '-'}</p>
                  </div>
                </div>

                {selected.petProfiles.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Hewan Peliharaan</p>
                    <div className="space-y-2">
                      {selected.petProfiles.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 text-sm">
                          <PawPrint className="h-4 w-4 text-primary" />
                          <span className="font-medium">{p.petName}</span>
                          <Badge variant="outline" className="text-[10px]">{p.petType.name}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selected.orders.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Riwayat Pesanan</p>
                    <div className="space-y-2">
                      {selected.orders.slice(0, 5).map((o) => (
                        <div key={o.id} className="flex items-center justify-between text-sm border-b border-border/60 pb-2">
                          <div>
                            <p className="font-mono text-xs">{o.id.slice(0, 12)}...</p>
                            <p className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatRupiah(o.total)}</p>
                            <Badge variant="outline" className="text-[9px]">{o.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
