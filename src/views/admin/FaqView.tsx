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
import { Plus, Pencil, Trash2, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Faq {
  id: string
  question: string
  answer: string
  order: number
  isActive: boolean
}

export function FaqView() {
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Faq | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/faqs')
      const data = await res.json()
      setFaqs(data.faqs || [])
    } catch {
      toast.error('Gagal memuat FAQ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus FAQ ini?')) return
    const res = await fetch(`/api/admin/faqs/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('FAQ dihapus')
      load()
    } else {
      toast.error('Gagal menghapus')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">FAQ</h1>
          <p className="text-sm text-muted-foreground">Kelola pertanyaan yang sering diajukan</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah FAQ
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : faqs.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <HelpCircle className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-sm font-medium">Belum ada FAQ</p>
          <p className="text-xs text-muted-foreground">Tambah pertanyaan untuk halaman kontak</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {faqs.map((f) => (
            <Card key={f.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">#{f.order}</Badge>
                    <Badge className={f.isActive ? 'bg-success text-success-foreground text-[10px]' : 'text-[10px]'}>
                      {f.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </div>
                  <p className="mt-2 font-semibold">{f.question}</p>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{f.answer}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(f); setDialogOpen(true) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(f.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <FaqDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={load}
      />
    </div>
  )
}

function FaqDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Faq | null
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    question: '', answer: '', order: '0', isActive: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) {
      setForm({
        question: editing.question,
        answer: editing.answer,
        order: String(editing.order),
        isActive: editing.isActive,
      })
    } else {
      setForm({
        question: '', answer: '', order: '0', isActive: true,
      })
    }
  }, [editing, open])

  const handleSave = async () => {
    if (!form.question || !form.answer) {
      toast.error('Pertanyaan dan jawaban wajib diisi')
      return
    }
    setSaving(true)
    try {
      const body = {
        question: form.question,
        answer: form.answer,
        order: parseInt(form.order) || 0,
        isActive: form.isActive,
      }
      const url = editing ? `/api/admin/faqs/${editing.id}` : '/api/admin/faqs'
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
      toast.success(editing ? 'FAQ diperbarui' : 'FAQ ditambahkan')
      onOpenChange(false)
      onSaved()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan FAQ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit FAQ' : 'Tambah FAQ'}</DialogTitle>
          <DialogDescription>Pertanyaan yang sering diajukan pelanggan</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Pertanyaan <span className="text-destructive">*</span></Label>
            <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className="mt-1.5" placeholder="Apakah produk sudah terdaftar BPOM?" />
          </div>
          <div>
            <Label>Jawaban <span className="text-destructive">*</span></Label>
            <Textarea
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
              className="mt-1.5 min-h-28"
              placeholder="Ya, semua produk kami sudah terdaftar di BPOM..."
            />
          </div>
          <div>
            <Label>Urutan</Label>
            <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} className="mt-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">Angka lebih kecil tampil lebih dulu</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            Tampilkan di halaman publik
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
