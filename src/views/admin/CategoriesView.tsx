'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Tags } from 'lucide-react'
import { toast } from 'sonner'
import { AdminActionMenu, AdminEmptyState, AdminPageHeader } from '@/components/admin/AdminListPrimitives'

interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
  _count: { products: number }
}

export function CategoriesView() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/categories')
    const data = await res.json()
    setCategories(data.categories || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader title="Kategori" description="Kelola kategori produk" action={<Button onClick={() => { setEditing(null); setDialogOpen(true) }} className="h-9 gap-2">
          <Plus className="h-4 w-4" /> Tambah Kategori
        </Button>} />

      <div className="grid gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)
        ) : categories.length === 0 ? <AdminEmptyState icon={<Tags className="h-8 w-8" />} title="Belum ada kategori" description="Buat kategori untuk merapikan katalog produk." action={<Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}><Plus className="mr-1.5 h-4 w-4" />Tambah Kategori</Button>} /> : categories.map((c) => (
          <Card key={c.id} className="flex items-center justify-between rounded-xl p-3 shadow-none">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Tags className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground">/{c.slug}</p>
                <Badge variant="outline" className="mt-1 text-[10px]">{c._count.products} produk</Badge>
              </div>
            </div>
            <AdminActionMenu items={[{ label: 'Edit kategori', onSelect: () => { setEditing(c); setDialogOpen(true) } }, { label: 'Hapus kategori', destructive: true, onSelect: async () => {
                  if (!confirm(`Hapus kategori "${c.name}"?`)) return
                  const res = await fetch(`/api/admin/categories/${c.id}`, { method: 'DELETE' })
                  if (res.ok) {
                    toast.success('Kategori dihapus')
                    load()
                  } else {
                    const data = await res.json()
                    toast.error(data.error || 'Gagal menghapus')
                  }
                }}]} />
          </Card>
        ))}
      </div>

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={load}
      />
    </div>
  )
}

function CategoryDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Category | null
  onSaved: () => void
}) {
  const [form, setForm] = useState({ name: '', icon: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      setForm({ name: editing.name, icon: editing.icon || '' })
    } else {
      setForm({ name: '', icon: '' })
    }
  }, [editing, open])

  const handleSave = async () => {
    if (!form.name) {
      toast.error('Nama wajib diisi')
      return
    }
    setSaving(true)
    try {
      const url = editing ? `/api/admin/categories/${editing.id}` : '/api/admin/categories'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Gagal menyimpan')
      }
      toast.success(editing ? 'Kategori diperbarui' : 'Kategori ditambahkan')
      onOpenChange(false)
      onSaved()
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Kategori' : 'Tambah Kategori'}</DialogTitle>
          <DialogDescription>Slug akan dibuat otomatis dari nama</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Nama Kategori <span className="text-destructive">*</span></Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Mis. Vitamin, Suplemen"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Icon (opsional)</Label>
            <Input
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              placeholder="Mis. pill, flask"
              className="mt-1.5"
            />
          </div>
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
