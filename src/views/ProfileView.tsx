'use client'

import { useState, useEffect } from 'react'
import { useHashRouter } from '@/lib/router'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { PawPrint, Plus, Pencil, Trash2, Mail, Phone, ShoppingBag, ChevronRight, CheckCircle2, LockKeyhole, LogOut } from 'lucide-react'
import { PetType } from '@/hooks/use-fetch'
import { toast } from 'sonner'

interface PetProfile {
  id: string
  petName: string
  petTypeId: string
  age: string
  weight: string
  notes: string | null
  petType: PetType
}

export function ProfileView() {
  const { user, loading, logout } = useAuth()
  const { navigate } = useHashRouter()
  const [petProfiles, setPetProfiles] = useState<PetProfile[]>([])
  const [petTypes, setPetTypes] = useState<PetType[]>([])
  const [editingPet, setEditingPet] = useState<PetProfile | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadPetProfiles = async () => {
    const [pRes, ptRes] = await Promise.all([
      fetch('/api/pet-profiles').then((r) => r.json()),
      fetch('/api/pet-types').then((r) => r.json()),
    ])
    setPetProfiles(pRes.petProfiles || [])
    setPetTypes(ptRes.petTypes || [])
  }

  useEffect(() => {
    loadPetProfiles()
  }, [])

  if (loading) return <div className="container-page py-20 text-center text-muted-foreground">Memuat...</div>
  if (!user) {
    navigate('/login')
    return null
  }

  const openAddPet = () => {
    setEditingPet(null)
    setDialogOpen(true)
  }

  const openEditPet = (pet: PetProfile) => {
    setEditingPet(pet)
    setDialogOpen(true)
  }

  const handleDeletePet = async (id: string) => {
    if (!confirm('Hapus profil hewan ini?')) return
    const res = await fetch(`/api/pet-profiles/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Profil hewan dihapus')
      loadPetProfiles()
    } else {
      toast.error('Gagal menghapus profil')
    }
  }

  return (
    <div className="container-page min-w-0 overflow-x-hidden px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-10 sm:pb-10">
      <div className="mx-auto min-w-0 max-w-3xl">
        <header className="mb-6 sm:mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Ruang personal Anda</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Akun</h1>
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">Kelola pesanan dan kebutuhan si kecil dalam satu tempat.</p>
        </header>

        <section className="border-b border-border/70 pb-6 sm:pb-7">
          <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xl font-bold text-white shadow-sm sm:size-16 sm:text-2xl">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="min-w-0 max-w-full break-words text-lg font-bold sm:text-xl">{user.name}</h2>
                {user.emailVerifiedAt ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success"><CheckCircle2 className="size-3.5" /> Terverifikasi</span>
                ) : <ResendVerificationButton />}
              </div>
              <p className="mt-1 break-all text-sm text-muted-foreground">{user.email}</p>
              {user.phone && <p className="mt-1 inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground"><Phone className="size-3.5 shrink-0" /> {maskPhone(user.phone)}</p>}
            </div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3" aria-label="Akses cepat">
          <button onClick={() => navigate('/orders')} className="group flex min-w-0 items-center gap-2.5 rounded-xl border border-border/70 bg-card px-3.5 py-3 text-left transition-colors hover:bg-accent sm:px-4 sm:py-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShoppingBag className="size-[18px]" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">Pesanan</span><span className="block truncate text-[11px] text-muted-foreground">Riwayat belanja</span></span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
          <button onClick={() => document.getElementById('pet-profiles')?.scrollIntoView({ behavior: 'smooth' })} className="group flex min-w-0 items-center gap-2.5 rounded-xl border border-border/70 bg-card px-3.5 py-3 text-left transition-colors hover:bg-accent sm:px-4 sm:py-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary"><PawPrint className="size-[18px]" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">Hewan Saya</span><span className="block truncate text-[11px] text-muted-foreground">Profil si kecil</span></span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        </section>

        <section id="pet-profiles" className="mt-9 scroll-mt-24 sm:mt-11">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">Personalisasi</p><h2 className="mt-1 text-lg font-bold sm:text-xl">Hewan Saya</h2></div>
            <Button size="sm" variant="outline" onClick={openAddPet} className="shrink-0 gap-1.5 rounded-lg"><Plus className="size-4" /> Tambah</Button>
          </div>
          {petProfiles.length === 0 ? (
            <div className="flex min-w-0 items-center gap-3 rounded-xl border border-dashed border-border bg-card/45 px-3.5 py-4 sm:px-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl">🐾</div>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Belum ada hewan</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">Tambahkan profil agar pengalaman Anima lebih personal.</p></div>
              <Button size="sm" onClick={openAddPet} className="shrink-0 gap-1"><Plus className="size-3.5" /> Tambah</Button>
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
              {petProfiles.map((pet) => (
                <div key={pet.id} className="min-w-0 rounded-xl border border-border/70 bg-card p-3.5 transition-colors hover:bg-accent/30 sm:p-4">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5"><div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><PawPrint className="size-5" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold">{pet.petName}</p><Badge variant="outline" className="mt-0.5 max-w-full truncate text-[10px]">{pet.petType.name}</Badge></div></div>
                    <div className="flex shrink-0 gap-0.5"><Button variant="ghost" size="icon" className="size-8" onClick={() => openEditPet(pet)} aria-label={`Edit ${pet.petName}`}><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => handleDeletePet(pet.id)} aria-label={`Hapus ${pet.petName}`}><Trash2 className="size-3.5" /></Button></div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><p className="text-muted-foreground">Umur</p><p className="font-medium">{pet.age || '-'}</p></div><div><p className="text-muted-foreground">Berat</p><p className="font-medium">{pet.weight || '-'}</p></div></div>
                  {pet.notes && <p className="mt-2 break-words text-xs text-muted-foreground italic">“{pet.notes}”</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-9 border-t border-border/70 pt-7 sm:mt-11">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">Pengaturan</p><h2 className="mt-1 text-lg font-bold sm:text-xl">Akun & keamanan</h2>
          <div className="mt-3 divide-y divide-border/70 border-y border-border/70">
            {user.provider === 'PASSWORD' && <button onClick={() => navigate('/forgot-password')} className="group flex min-h-14 w-full min-w-0 items-center gap-3 text-left"><LockKeyhole className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Ubah password</span><span className="block truncate text-xs text-muted-foreground">Kirim kode reset ke email akun</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></button>}
            <div className="flex min-h-14 min-w-0 items-center gap-3"><CheckCircle2 className="size-4 shrink-0 text-success" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Status email</span><span className="block truncate text-xs text-muted-foreground">{user.emailVerifiedAt ? 'Email terverifikasi' : 'Email belum terverifikasi'}</span></span></div>
          </div>
        </section>

        <section className="mt-8 border-t border-border/70 pt-7"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">Bantuan</p><button onClick={() => navigate('/kontak')} className="group mt-3 flex min-h-14 w-full min-w-0 items-center gap-3 border-y border-border/70 text-left"><Mail className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Hubungi Anima</span><span className="block truncate text-xs text-muted-foreground">Kami siap membantu kebutuhan Anda</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></button></section>
        <button onClick={() => logout()} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 px-4 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/5"><LogOut className="size-4" /> Keluar</button>
      </div>
      <PetProfileDialog open={dialogOpen} onOpenChange={setDialogOpen} editingPet={editingPet} petTypes={petTypes} onSaved={loadPetProfiles} />
    </div>
  )}

function maskPhone(phone: string) {
  if (phone.length < 7) return phone
  return `${phone.slice(0, 4)}••••${phone.slice(-3)}`
}

function PetProfileDialog({
  open, onOpenChange, editingPet, petTypes, onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editingPet: PetProfile | null
  petTypes: PetType[]
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    petName: '',
    petTypeId: '',
    age: '',
    weight: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editingPet) {
      setForm({
        petName: editingPet.petName,
        petTypeId: editingPet.petTypeId,
        age: editingPet.age,
        weight: editingPet.weight,
        notes: editingPet.notes || '',
      })
    } else {
      setForm({ petName: '', petTypeId: '', age: '', weight: '', notes: '' })
    }
  }, [editingPet, open])

  const handleSave = async () => {
    if (!form.petName || !form.petTypeId) {
      toast.error('Nama dan jenis hewan wajib diisi')
      return
    }
    setSaving(true)
    try {
      const url = editingPet ? `/api/pet-profiles/${editingPet.id}` : '/api/pet-profiles'
      const method = editingPet ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Gagal menyimpan')
      toast.success(editingPet ? 'Profil diperbarui' : 'Profil hewan ditambahkan')
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error('Gagal menyimpan profil')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingPet ? 'Edit Profil Hewan' : 'Tambah Hewan Peliharaan'}
          </DialogTitle>
          <DialogDescription>
            Data ini akan membantu personalisasi pengalaman belanja Anda
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Nama Hewan <span className="text-destructive">*</span></Label>
            <Input
              value={form.petName}
              onChange={(e) => setForm({ ...form, petName: e.target.value })}
              placeholder="Mis. Tommy, Luna, Bruno"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Jenis Hewan <span className="text-destructive">*</span></Label>
            <Select value={form.petTypeId} onValueChange={(v) => setForm({ ...form, petTypeId: v })}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Pilih jenis hewan" />
              </SelectTrigger>
              <SelectContent>
                {petTypes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Umur</Label>
              <Input
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                placeholder="Mis. 2 tahun"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Berat Badan</Label>
              <Input
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                placeholder="Mis. 4.5 kg"
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label>Catatan</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Mis. Kondisi khusus, alergi, preferensi makanan"
              rows={2}
              className="mt-1.5"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Menyimpan...' : editingPet ? 'Simpan Perubahan' : 'Tambah Hewan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// === Verified Identity V1 — local helper components ===

/**
 * ResendVerificationButton — calls /api/auth/verify-email/request to
 * issue a new verification token + send the verification email.
 *
 * Idempotent: if the user is already verified, the server returns
 * `{ alreadyVerified: true }` and we show a success toast anyway.
 */
function ResendVerificationButton() {
  const [sending, setSending] = useState(false)

  const handleResend = async () => {
    setSending(true)
    try {
      const res = await fetch('/api/auth/verify-email/request', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Gagal mengirim email verifikasi')
        return
      }
      if (data.alreadyVerified) {
        toast.success('Email Anda sudah terverifikasi.')
      } else {
        toast.success('Email verifikasi telah dikirim. Cek kotak masuk Anda.')
      }
    } catch {
      toast.error('Gagal mengirim email verifikasi')
    } finally {
      setSending(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 gap-1 text-xs"
      onClick={handleResend}
      disabled={sending}
    >
      {sending ? 'Mengirim...' : 'Kirim ulang'}
    </Button>
  )
}
