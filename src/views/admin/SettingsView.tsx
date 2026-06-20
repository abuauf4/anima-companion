'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Save, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

interface SiteSetting {
  id: string
  // Hero
  heroEyebrow: string
  heroTitle1: string
  heroTitle2: string
  heroDescription: string
  heroHookTitle1: string
  heroHookTitle2: string
  // Trust badges
  trustBadge1Value: string
  trustBadge1Label: string
  trustBadge2Value: string
  trustBadge2Label: string
  trustBadge3Value: string
  trustBadge3Label: string
  trustBadge4Value: string
  trustBadge4Label: string
  // Contact
  whatsappNumber: string
  email: string
  instagram: string
  instagramUrl: string
  shopeeUrl: string
  tokopediaUrl: string
  tiktokUrl: string
  // Announcement bar
  announcement1: string
  announcement2: string
  announcement3: string
  announcement4: string
  // Misc
  freeShippingThreshold: number
  updatedAt: string
}

const EMPTY_FORM: SiteSetting = {
  id: 'singleton',
  heroEyebrow: '', heroTitle1: '', heroTitle2: '', heroDescription: '',
  heroHookTitle1: '', heroHookTitle2: '',
  trustBadge1Value: '', trustBadge1Label: '',
  trustBadge2Value: '', trustBadge2Label: '',
  trustBadge3Value: '', trustBadge3Label: '',
  trustBadge4Value: '', trustBadge4Label: '',
  whatsappNumber: '', email: '', instagram: '',
  instagramUrl: '', shopeeUrl: '', tokopediaUrl: '', tiktokUrl: '',
  announcement1: '', announcement2: '', announcement3: '', announcement4: '',
  freeShippingThreshold: 0,
  updatedAt: '',
}

export function SettingsView() {
  const [form, setForm] = useState<SiteSetting>(EMPTY_FORM)
  const [original, setOriginal] = useState<SiteSetting>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings')
      if (!res.ok) throw new Error('Gagal memuat')
      const data = await res.json()
      const s: SiteSetting = data.settings
      setForm(s)
      setOriginal(s)
    } catch {
      toast.error('Gagal memuat pengaturan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Gagal menyimpan')
      }
      const data = await res.json()
      setForm(data.settings)
      setOriginal(data.settings)
      toast.success('Pengaturan disimpan')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan pengaturan')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setForm(original)
    toast.info('Perubahan dibatalkan')
  }

  const hasChanges = JSON.stringify(form) !== JSON.stringify(original)

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pengaturan Situs</h1>
          <p className="text-sm text-muted-foreground">Kelola teks homepage, badge, kontak & pengumuman</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges || saving} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          Ada perubahan yang belum disimpan. Klik <strong>Simpan</strong> untuk menerapkan.
        </div>
      )}

      {/* HERO SECTION */}
      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">Hero Section</h2>
          <p className="text-xs text-muted-foreground">Teks utama di bagian atas homepage</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Eyebrow (label kecil di atas judul)">
            <Input value={form.heroEyebrow} onChange={(e) => setForm({ ...form, heroEyebrow: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Judul Baris 1">
              <Input value={form.heroTitle1} onChange={(e) => setForm({ ...form, heroTitle1: e.target.value })} />
            </Field>
            <Field label="Judul Baris 2 (highlight)">
              <Input value={form.heroTitle2} onChange={(e) => setForm({ ...form, heroTitle2: e.target.value })} />
            </Field>
          </div>
        </div>
        <Field label="Deskripsi">
          <Textarea
            value={form.heroDescription}
            onChange={(e) => setForm({ ...form, heroDescription: e.target.value })}
            className="min-h-20"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hook Judul Baris 1">
            <Input value={form.heroHookTitle1} onChange={(e) => setForm({ ...form, heroHookTitle1: e.target.value })} />
          </Field>
          <Field label="Hook Judul Baris 2 (highlight)">
            <Input value={form.heroHookTitle2} onChange={(e) => setForm({ ...form, heroHookTitle2: e.target.value })} />
          </Field>
        </div>
      </Card>

      {/* TRUST BADGES */}
      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">Trust Badges</h2>
          <p className="text-xs text-muted-foreground">4 statistik di bawah hero section</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([1, 2, 3, 4] as const).map((n) => (
            <div key={n} className="space-y-2 rounded-lg border border-border/60 p-3">
              <p className="text-xs font-semibold text-muted-foreground">Badge {n}</p>
              <Field label="Nilai">
                <Input
                  value={form[`trustBadge${n}Value` as keyof SiteSetting] as string}
                  onChange={(e) => setForm({ ...form, [`trustBadge${n}Value`]: e.target.value } as SiteSetting)}
                  placeholder="50rb+"
                />
              </Field>
              <Field label="Label">
                <Input
                  value={form[`trustBadge${n}Label` as keyof SiteSetting] as string}
                  onChange={(e) => setForm({ ...form, [`trustBadge${n}Label`]: e.target.value } as SiteSetting)}
                  placeholder="Pelanggan"
                />
              </Field>
            </div>
          ))}
        </div>
      </Card>

      {/* CONTACT */}
      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">Kontak & Sosial Media</h2>
          <p className="text-xs text-muted-foreground">Informasi kontak yang ditampilkan di situs</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nomor WhatsApp (format internasional tanpa +)">
            <Input value={form.whatsappNumber} onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })} placeholder="6281234567890" />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="hello@animacompanion.id" />
          </Field>
          <Field label="Instagram (handle)">
            <Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@anima.companion" />
          </Field>
          <Field label="URL Instagram">
            <Input value={form.instagramUrl} onChange={(e) => setForm({ ...form, instagramUrl: e.target.value })} placeholder="https://instagram.com/..." />
          </Field>
          <Field label="URL Shopee">
            <Input value={form.shopeeUrl} onChange={(e) => setForm({ ...form, shopeeUrl: e.target.value })} placeholder="https://shopee.co.id/..." />
          </Field>
          <Field label="URL Tokopedia">
            <Input value={form.tokopediaUrl} onChange={(e) => setForm({ ...form, tokopediaUrl: e.target.value })} placeholder="https://www.tokopedia.com/..." />
          </Field>
          <Field label="URL TikTok (opsional)">
            <Input value={form.tiktokUrl} onChange={(e) => setForm({ ...form, tiktokUrl: e.target.value })} placeholder="https://tiktok.com/@..." />
          </Field>
        </div>
      </Card>

      {/* ANNOUNCEMENT BAR */}
      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">Announcement Bar</h2>
          <p className="text-xs text-muted-foreground">Pesan yang berputar di bar paling atas situs</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pengumuman 1">
            <Input value={form.announcement1} onChange={(e) => setForm({ ...form, announcement1: e.target.value })} />
          </Field>
          <Field label="Pengumuman 2 (Flash Sale — tampil dengan countdown)">
            <Input value={form.announcement2} onChange={(e) => setForm({ ...form, announcement2: e.target.value })} />
          </Field>
          <Field label="Pengumuman 3">
            <Input value={form.announcement3} onChange={(e) => setForm({ ...form, announcement3: e.target.value })} />
          </Field>
          <Field label="Pengumuman 4">
            <Input value={form.announcement4} onChange={(e) => setForm({ ...form, announcement4: e.target.value })} />
          </Field>
        </div>
      </Card>

      {/* MISC */}
      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">Lain-lain</h2>
          <p className="text-xs text-muted-foreground">Pengaturan operasional toko</p>
        </div>
        <Field label="Minimum Pembelian untuk Gratis Ongkir (Rp)">
          <Input
            type="number"
            value={form.freeShippingThreshold}
            onChange={(e) => setForm({ ...form, freeShippingThreshold: parseInt(e.target.value) || 0 })}
            className="max-w-xs"
          />
        </Field>
      </Card>

      {/* Sticky save bar at bottom */}
      {hasChanges && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">Perubahan belum disimpan</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>Batal</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" /> {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}
