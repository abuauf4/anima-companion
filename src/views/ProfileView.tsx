'use client'

import { useState, useEffect } from 'react'
import { useHashRouter } from '@/lib/router'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { User, PawPrint, Plus, Pencil, Trash2, Mail, Phone, ShoppingBag } from 'lucide-react'
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
  const { user, loading } = useAuth()
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
    <div className="container-page py-6">
      <h1 className="mb-6 text-2xl font-bold md:text-3xl">Profil Saya</h1>

      <div className="grid gap-6 md:grid-cols-3">
        {/* User info card */}
        <Card className="p-6 md:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full gradient-brand text-3xl font-bold text-white">
              {user.name.charAt(0)}
            </div>
            <h2 className="mt-3 text-lg font-bold">{user.name}</h2>
            <Badge variant="outline" className="mt-1">
              {user.role === 'ADMIN' ? 'Administrator' : 'Pelanggan'}
            </Badge>

            <div className="mt-4 w-full space-y-2 border-t border-border pt-4 text-left text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" /> <span className="text-foreground">{user.email}</span>
              </div>
              {user.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" /> <span className="text-foreground">{user.phone}</span>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              className="mt-4 w-full gap-2"
              onClick={() => navigate('/orders')}
            >
              <ShoppingBag className="h-4 w-4" /> Riwayat Pesanan
            </Button>
          </div>
        </Card>

        {/* Pet profiles */}
        <Card className="p-6 md:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <PawPrint className="h-5 w-5 text-primary" /> Hewan Peliharaan Saya
            </h2>
            <Button size="sm" onClick={openAddPet} className="gap-1">
              <Plus className="h-4 w-4" /> Tambah
            </Button>
          </div>

          {petProfiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
              <div className="mb-3 text-4xl">🐾</div>
              <p className="text-sm font-medium">Belum ada hewan peliharaan</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tambahkan profil hewan Anda untuk pengalaman belanja yang lebih personal
              </p>
              <Button size="sm" onClick={openAddPet} className="mt-3 gap-1">
                <Plus className="h-4 w-4" /> Tambah Hewan
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {petProfiles.map((pet) => (
                <div
                  key={pet.id}
                  className="rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/30"
                >
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
        </Card>
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
