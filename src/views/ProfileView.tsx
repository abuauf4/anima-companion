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
    <div className="container-page py-7 pb-10 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-7">
          <p className="text-sm font-semibold text-primary">Ruang personal Anda</p>
          <h1 className="mt-1 text-2xl font-bold md:text-3xl">Akun Saya</h1>
          <p className="mt-2 text-sm text-muted-foreground">Kelola pesanan dan profil hewan kesayangan dalam satu tempat.</p>
        </div>

        <section className="relative overflow-hidden rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border/70 sm:p-7">
          <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl gradient-brand text-2xl font-bold text-white shadow-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold">{user.name}</h2>
                  {user.emailVerifiedAt ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><CheckCircle2 className="size-3.5" /> Terverifikasi</span>
                  ) : <ResendVerificationButton />}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Pelanggan Anima Companion</p>
                <div className="mt-3 flex flex-col gap-1 text-sm text-foreground/80 sm:flex-row sm:gap-4">
                  <span className="inline-flex items-center gap-2"><Mail className="size-3.5 text-muted-foreground" /> {user.email}</span>
                  {user.phone && <span className="inline-flex items-center gap-2"><Phone className="size-3.5 text-muted-foreground" /> {maskPhone(user.phone)}</span>}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground sm:max-w-[10rem] sm:text-right">Data profil saat ini tersimpan aman di akun Anda.</p>
          </div>
        </section>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button onClick={() => navigate('/orders')} className="group flex items-center justify-between rounded-xl bg-accent/55 p-4 text-left transition-colors hover:bg-accent">
            <span className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary"><ShoppingBag className="size-5" /></span><span><span className="block text-sm font-semibold">Pesanan</span><span className="block text-xs text-muted-foreground">Lihat riwayat belanja</span></span></span>
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
          <button onClick={() => document.getElementById('pet-profiles')?.scrollIntoView({ behavior: 'smooth' })} className="group flex items-center justify-between rounded-xl bg-accent/55 p-4 text-left transition-colors hover:bg-accent">
            <span className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-secondary/10 text-secondary"><PawPrint className="size-5" /></span><span><span className="block text-sm font-semibold">Hewan Saya</span><span className="block text-xs text-muted-foreground">Personalisasi kebutuhan mereka</span></span></span>
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <section id="pet-profiles" className="mt-10 scroll-mt-24">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">Profil hewan</p>
              <h2 className="mt-1 flex items-center gap-2 text-xl font-bold"><PawPrint className="size-5 text-primary" /> Hewan Saya</h2>
            </div>
            <Button size="sm" variant="outline" onClick={openAddPet} className="gap-1.5 rounded-lg"><Plus className="size-4" /> Tambah</Button>
          </div>

          {petProfiles.length === 0 ? (
            <div className="flex items-center gap-4 rounded-2xl border border-dashed border-border bg-card/55 px-5 py-6">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl">🐾</div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Belum ada profil hewan</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Tambahkan profil untuk membantu kami menyesuaikan pengalaman belanja.</p>
              </div>
              <Button size="sm" onClick={openAddPet} className="ml-auto shrink-0 gap-1"><Plus className="size-4" /> Tambah</Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {petProfiles.map((pet) => (
                <div key={pet.id} className="rounded-2xl bg-card p-4 ring-1 ring-border/70 transition-shadow hover:shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <PawPrint className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-semibold">{pet.petName}</p>
                        <Badge variant="outline" className="mt-0.5 text-[10px]">{pet.petType.name}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPet(pet)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeletePet(pet.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Umur</p>
                      <p className="font-medium">{pet.age || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Berat</p>
                      <p className="font-medium">{pet.weight || '-'}</p>
                    </div>
                  </div>
                  {pet.notes && (
                    <p className="mt-2 text-xs text-muted-foreground italic">"{pet.notes}"</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 border-t border-border/70 pt-7">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">Pengaturan</p>
            <h2 className="mt-1 text-xl font-bold">Akun & keamanan</h2>
          </div>
          <div className="divide-y divide-border/70 rounded-2xl bg-card px-4 ring-1 ring-border/70">
            {user.provider === 'PASSWORD' && (
              <button onClick={() => navigate('/forgot-password')} className="group flex min-h-14 w-full items-center gap-3 text-left">
                <LockKeyhole className="size-4 text-muted-foreground" />
                <span className="flex-1"><span className="block text-sm font-semibold">Ubah password</span><span className="block text-xs text-muted-foreground">Kirim kode reset ke email akun</span></span>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
            <div className="flex min-h-14 items-center gap-3">
              <CheckCircle2 className="size-4 text-success" />
              <span className="flex-1"><span className="block text-sm font-semibold">Status email</span><span className="block text-xs text-muted-foreground">{user.emailVerifiedAt ? 'Email terverifikasi' : 'Email belum terverifikasi'}</span></span>
            </div>
            <button onClick={() => logout()} className="flex min-h-14 w-full items-center gap-3 text-left text-destructive">
              <LogOut className="size-4" />
              <span className="text-sm font-semibold">Keluar dari akun</span>
            </button>
          </div>
        </section>
      </div>

      <PetProfileDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingPet={editingPet}
        petTypes={petTypes}
        onSaved={loadPetProfiles}
      />
    </div>
  )
}

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
