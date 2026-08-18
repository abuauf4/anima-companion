'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, MessageSquare, Star } from 'lucide-react'
import { toast } from 'sonner'
import { AdminActionMenu, AdminEmptyState, AdminStatusBadge } from '@/components/admin/AdminListPrimitives'

interface Testimonial {
  id: string
  name: string
  petName: string
  petType: string
  message: string
  rating: number
  avatar: string | null
  isActive: boolean
}

const PET_TYPE_OPTIONS = ['Kucing', 'Anjing', 'Kelinci', 'Burung', 'Reptil', 'Lainnya'] as const

export function TestimonialsView() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Testimonial | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/testimonials')
      const data = await res.json()
      setTestimonials(data.testimonials || [])
    } catch {
      toast.error('Gagal memuat testimoni')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus testimoni ini?')) return
    const res = await fetch(`/api/admin/testimonials/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Testimoni dihapus')
      load()
    } else {
      toast.error('Gagal menghapus')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Testimoni</h1>
          <p className="text-sm text-muted-foreground">Kelola ulasan pelanggan di homepage</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah Testimoni
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : testimonials.length === 0 ? (
        <AdminEmptyState icon={<MessageSquare className="h-8 w-8" />} title="Belum ada testimoni" description="Tambah testimoni untuk ditampilkan di homepage." action={<Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}><Plus className="mr-1.5 h-4 w-4" />Tambah Testimoni</Button>} />
      ) : (
        <div className="space-y-2">
          {testimonials.map((t) => (
            <Card key={t.id} className="rounded-xl p-3 shadow-none">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full gradient-brand text-sm font-bold text-white">
                  {t.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.petName} · {t.petType}</p>
                    </div>
                    <AdminActionMenu items={[{ label: 'Edit testimoni', onSelect: () => { setEditing(t); setDialogOpen(true) } }, { label: 'Hapus testimoni', destructive: true, onSelect: () => handleDelete(t.id) }]} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`size-3.5 ${i < t.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-foreground/90 line-clamp-3">&ldquo;{t.message}&rdquo;</p>
                  <div className="mt-2">
                    <AdminStatusBadge tone={t.isActive ? 'success' : 'neutral'}>
                      {t.isActive ? 'Aktif' : 'Nonaktif'}
                    </AdminStatusBadge>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <TestimonialDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={load}
      />
    </div>
  )
}

function TestimonialDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Testimonial | null
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: '', petName: '', petType: 'Kucing',
    message: '', rating: '5', avatar: '', isActive: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        petName: editing.petName,
        petType: editing.petType,
        message: editing.message,
        rating: String(editing.rating),
        avatar: editing.avatar || '',
        isActive: editing.isActive,
      })
    } else {
      setForm({
        name: '', petName: '', petType: 'Kucing',
        message: '', rating: '5', avatar: '', isActive: true,
      })
    }
  }, [editing, open])

  const handleSave = async () => {
    if (!form.name || !form.petName || !form.message) {
      toast.error('Nama, nama hewan, dan pesan wajib diisi')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name,
        petName: form.petName,
        petType: form.petType,
        message: form.message,
        rating: parseInt(form.rating) || 5,
        avatar: form.avatar || null,
        isActive: form.isActive,
      }
      const url = editing ? `/api/admin/testimonials/${editing.id}` : '/api/admin/testimonials'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal menyimpan')
      }
      toast.success(editing ? 'Testimoni diperbarui' : 'Testimoni ditambahkan')
      onOpenChange(false)
      onSaved()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan testimoni')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-mobile-dialog max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-1rem)] overflow-y-auto p-4 top-4 translate-y-0 sm:top-[50%] sm:max-h-[90vh] sm:max-w-lg sm:translate-y-[-50%] sm:p-6">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Testimoni' : 'Tambah Testimoni'}</DialogTitle>
          <DialogDescription>Ulasan pelanggan untuk ditampilkan di homepage</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Nama Pelanggan <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" placeholder="Budi Santoso" />
            </div>
            <div>
              <Label>Nama Hewan <span className="text-destructive">*</span></Label>
              <Input value={form.petName} onChange={(e) => setForm({ ...form, petName: e.target.value })} className="mt-1.5" placeholder="Mochi" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Jenis Hewan</Label>
              <Select value={form.petType} onValueChange={(v) => setForm({ ...form, petType: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PET_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rating</Label>
              <Select value={form.rating} onValueChange={(v) => setForm({ ...form, rating: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 4, 3, 2, 1].map((r) => (
                    <SelectItem key={r} value={String(r)}>{'★'.repeat(r)} ({r})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Pesan / Ulasan <span className="text-destructive">*</span></Label>
            <Textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="mt-1.5 min-h-24"
              placeholder="Produknya bagus, kucing saya jadi lebih sehat..."
            />
          </div>
          <div>
            <Label>URL Avatar (opsional)</Label>
            <Input value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value })} className="mt-1.5" placeholder="https://..." />
          </div>
          <label className="flex min-h-10 items-center gap-3 rounded-lg border border-border/70 px-3 text-sm">
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            Tampilkan di homepage
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
