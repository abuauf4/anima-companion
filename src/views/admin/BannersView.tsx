'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

interface Banner {
  id: string
  title: string
  subtitle: string | null
  imageUrl: string
  link: string | null
  position: string
  order: number
  isActive: boolean
}

export function BannersView() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Banner | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/banners')
    const data = await res.json()
    setBanners(data.banners || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus banner ini?')) return
    await fetch(`/api/admin/banners/${id}`, { method: 'DELETE' })
    toast.success('Banner dihapus')
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Banner</h1>
          <p className="text-sm text-muted-foreground">Kelola banner homepage & promo</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah Banner
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : banners.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <ImageIcon className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-sm font-medium">Belum ada banner</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {banners.map((b) => (
            <Card key={b.id} className="flex gap-4 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.imageUrl} alt={b.title} className="h-20 w-32 shrink-0 rounded-lg border border-border object-cover" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{b.title}</p>
                    {b.subtitle && <p className="text-xs text-muted-foreground truncate">{b.subtitle}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(b); setDialogOpen(true) }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(b.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[10px]">{b.position === 'HOME' ? 'Homepage' : b.position === 'PROMO' ? 'Promo' : b.position}</Badge>
                  <Badge variant="outline" className="text-[10px]">Order: {b.order}</Badge>
                  <Badge className={b.isActive ? 'bg-success text-success-foreground text-[10px]' : 'text-[10px]'}>
                    {b.isActive ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                  {b.link && <span className="text-muted-foreground truncate">→ {b.link}</span>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <BannerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={load}
      />
    </div>
  )
}

function BannerDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Banner | null
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    title: '', subtitle: '', imageUrl: '', link: '',
    position: 'HOME', order: '0', isActive: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title,
        subtitle: editing.subtitle || '',
        imageUrl: editing.imageUrl,
        link: editing.link || '',
        position: editing.position,
        order: String(editing.order),
        isActive: editing.isActive,
      })
    } else {
      setForm({
        title: '', subtitle: '', imageUrl: '', link: '',
        position: 'HOME', order: '0', isActive: true,
      })
    }
  }, [editing, open])

  const handleSave = async () => {
    if (!form.title || !form.imageUrl) {
      toast.error('Title dan URL gambar wajib diisi')
      return
    }
    setSaving(true)
    try {
      const body = {
        ...form,
        order: parseInt(form.order) || 0,
      }
      const url = editing ? `/api/admin/banners/${editing.id}` : '/api/admin/banners'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Gagal menyimpan')
      toast.success(editing ? 'Banner diperbarui' : 'Banner ditambahkan')
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error('Gagal menyimpan banner')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Banner' : 'Tambah Banner'}</DialogTitle>
          <DialogDescription>Banner untuk homepage dan promo section</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Judul <span className="text-destructive">*</span></Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label>Subtitle</Label>
            <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label>URL Gambar <span className="text-destructive">*</span></Label>
            <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Posisi</Label>
              <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOME">Homepage</SelectItem>
                  <SelectItem value="PROMO">Promo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Urutan</Label>
              <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label>Link (opsional)</Label>
            <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="#/shop" className="mt-1.5" />
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
