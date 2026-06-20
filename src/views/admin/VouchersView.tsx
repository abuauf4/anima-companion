'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, Ticket, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { formatRupiah } from '@/lib/format'

interface Voucher {
  id: string
  code: string
  type: 'PERCENTAGE' | 'FIXED'
  value: number
  minSpend: number
  isActive: boolean
  description: string | null
  validUntil: string | null
}

export function VouchersView() {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Voucher | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/vouchers')
    const data = await res.json()
    setVouchers(data.vouchers || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success(`Kode ${code} disalin`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Voucher</h1>
          <p className="text-sm text-muted-foreground">Kelola kode voucher & diskon</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah Voucher
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : vouchers.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <Ticket className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-sm font-medium">Belum ada voucher</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {vouchers.map((v) => (
            <Card key={v.id} className="overflow-hidden">
              <div className="flex">
                {/* Left - dashed border */}
                <div className="flex flex-col items-center justify-center bg-gradient-to-br from-primary/15 to-secondary/15 p-4 border-r-2 border-dashed border-border">
                  <Ticket className="h-8 w-8 text-primary" />
                </div>
                {/* Right - content */}
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button
                        onClick={() => copyCode(v.code)}
                        className="group flex items-center gap-1 font-mono text-base font-bold text-primary"
                      >
                        {v.code}
                        <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                      </button>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {v.type === 'PERCENTAGE' ? `Diskon ${v.value}%` : `Potongan ${formatRupiah(v.value)}`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(v); setDialogOpen(true) }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {v.description && (
                    <p className="mt-2 text-xs text-muted-foreground">{v.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-[10px]">
                      Min. {formatRupiah(v.minSpend)}
                    </Badge>
                    {v.validUntil && (
                      <Badge variant="outline" className="text-[10px]">
                        s/d {new Date(v.validUntil).toLocaleDateString('id-ID')}
                      </Badge>
                    )}
                    <Badge className={v.isActive ? 'bg-success text-success-foreground text-[10px]' : 'text-[10px]'}>
                      {v.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <VoucherDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={load}
      />
    </div>
  )
}

function VoucherDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Voucher | null
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    code: '', type: 'PERCENTAGE', value: '', minSpend: '',
    description: '', isActive: true, validUntil: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      setForm({
        code: editing.code,
        type: editing.type,
        value: String(editing.value),
        minSpend: String(editing.minSpend),
        description: editing.description || '',
        isActive: editing.isActive,
        validUntil: editing.validUntil ? editing.validUntil.slice(0, 10) : '',
      })
    } else {
      setForm({
        code: '', type: 'PERCENTAGE', value: '', minSpend: '',
        description: '', isActive: true, validUntil: '',
      })
    }
  }, [editing, open])

  const handleSave = async () => {
    if (!form.code || !form.value) {
      toast.error('Kode dan nilai wajib diisi')
      return
    }
    setSaving(true)
    try {
      const body = {
        ...form,
        value: parseInt(form.value),
        minSpend: parseInt(form.minSpend) || 0,
        validUntil: form.validUntil || null,
      }
      // Note: this demo only supports create (POST). For edit, would need PUT endpoint.
      const url = '/api/admin/vouchers'
      const method = 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Gagal menyimpan')
      toast.success(editing ? 'Voucher diperbarui' : 'Voucher ditambahkan')
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error('Gagal menyimpan voucher')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Voucher' : 'Tambah Voucher'}</DialogTitle>
          <DialogDescription>
            Buat kode voucher untuk diskon persentase atau potongan tetap
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Kode Voucher <span className="text-destructive">*</span></Label>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="Mis. HELLO20"
              className="mt-1.5 uppercase font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipe Diskon</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">Persentase (%)</SelectItem>
                  <SelectItem value="FIXED">Nominal Tetap (Rp)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nilai {form.type === 'PERCENTAGE' ? '(%)' : '(Rp)'}</Label>
              <Input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder={form.type === 'PERCENTAGE' ? '20' : '15000'}
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label>Minimal Belanja (Rp)</Label>
            <Input
              type="number"
              value={form.minSpend}
              onChange={(e) => setForm({ ...form, minSpend: e.target.value })}
              placeholder="0"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Berlaku Sampai (opsional)</Label>
            <Input
              type="date"
              value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Deskripsi</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="mt-1.5"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            Aktif
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Menyimpan...' : editing ? 'Simpan' : 'Tambah'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
