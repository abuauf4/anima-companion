'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Save, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { utcIsoToWibLocalInput, wibLocalInputToUtcIso } from '@/lib/tz'

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
  // Promo / Announcement campaign — configurable countdown bar above navbar.
  // See schema.prisma for state-machine semantics.
  // promoStartAt / promoEndAt are UTC ISO strings on the wire; the admin UI
  // converts to/from Asia/Jakarta local datetime via lib/tz helpers.
  promoActive: boolean
  promoTitle: string
  promoStartAt: string | null
  promoEndAt: string | null
  promoCountdown: boolean
  promoTextBefore: string
  promoTextDuring: string
  promoLink: string
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
  promoActive: false,
  promoTitle: '',
  promoStartAt: null,
  promoEndAt: null,
  promoCountdown: true,
  promoTextBefore: '',
  promoTextDuring: '',
  promoLink: '',
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
      <Card className="space-y-4 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Hero Section</h2>
          <p className="text-xs text-muted-foreground">Teks utama di bagian atas homepage</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Eyebrow (label kecil di atas judul)">
            <Input value={form.heroEyebrow} onChange={(e) => setForm({ ...form, heroEyebrow: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Hook Judul Baris 1">
            <Input value={form.heroHookTitle1} onChange={(e) => setForm({ ...form, heroHookTitle1: e.target.value })} />
          </Field>
          <Field label="Hook Judul Baris 2 (highlight)">
            <Input value={form.heroHookTitle2} onChange={(e) => setForm({ ...form, heroHookTitle2: e.target.value })} />
          </Field>
        </div>
      </Card>

      {/* TRUST BADGES */}
      <Card className="space-y-4 p-4 sm:p-6">
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
      <Card className="space-y-4 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Kontak & Sosial Media</h2>
          <p className="text-xs text-muted-foreground">Informasi kontak yang ditampilkan di situs</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nomor WhatsApp (format internasional tanpa +)">
            <Input value={form.whatsappNumber} onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })} placeholder="6282210846408" />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="sutanvetmedika@gmail.com" />
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
      <Card className="space-y-4 p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Announcement Bar</h2>
          <p className="text-xs text-muted-foreground">Pesan yang berputar di bar paling atas situs</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pengumuman 1">
            <Input value={form.announcement1} onChange={(e) => setForm({ ...form, announcement1: e.target.value })} />
          </Field>
          <Field label="Pengumuman 2">
            <Input value={form.announcement2} onChange={(e) => setForm({ ...form, announcement2: e.target.value })} />
          </Field>
          <Field label="Pengumuman 3">
            <Input value={form.announcement3} onChange={(e) => setForm({ ...form, announcement3: e.target.value })} />
          </Field>
          <Field label="Pengumuman 4">
            <Input value={form.announcement4} onChange={(e) => setForm({ ...form, announcement4: e.target.value })} />
          </Field>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Catatan: ketika <strong>Promo / Announcement Campaign</strong> di bawah aktif dan sedang dalam periode berjalan, campaign tersebut akan menggantikan pesan di atas secara otomatis.
        </p>
      </Card>

      {/* PROMO / ANNOUNCEMENT CAMPAIGN */}
      <PromoCampaignCard form={form} setForm={setForm} />

      {/* MISC */}
      <Card className="space-y-4 p-4 sm:p-6">
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

/**
 * Promo / Announcement Campaign card.
 *
 * State machine (server-enforced + client-previewed):
 *   - promoActive=false  → bar shows rotating announcement1–4
 *   - promoActive=true, now < startAt  → "before" promo, count to start
 *   - promoActive=true, start ≤ now ≤ end   → "during" promo, count to end
 *   - promoActive=true, now > endAt    → promo ended, fall back to rotating
 *
 * Datetime inputs are interpreted as Asia/Jakarta (WIB, UTC+7). Conversion
 * to/from UTC ISO strings for the wire happens in src/lib/tz.ts.
 */
function PromoCampaignCard({
  form,
  setForm,
}: {
  form: SiteSetting
  setForm: (f: SiteSetting) => void
}) {
  // Convert UTC ISO (server storage) → "YYYY-MM-DDTHH:mm" for the input,
  // interpreted as Asia/Jakarta wall-clock.
  const startLocal = utcIsoToWibLocalInput(form.promoStartAt)
  const endLocal = utcIsoToWibLocalInput(form.promoEndAt)

  // Live preview of the campaign phase (best-effort, not authoritative —
  // the actual phase is recomputed in real-time on the storefront).
  const phasePreview = (() => {
    if (!form.promoActive) return 'Nonaktif — bar menampilkan announcement biasa'
    if (!form.promoStartAt || !form.promoEndAt) return 'Tanggal mulai & selesai wajib diisi'
    const now = Date.now()
    const s = new Date(form.promoStartAt).getTime()
    const e = new Date(form.promoEndAt).getTime()
    if (now < s) return 'Belum mulai — bar menampilkan teks "sebelum" + countdown ke mulai'
    if (now <= e) return 'Sedang berjalan — bar menampilkan teks "selama" + countdown ke selesai'
    return 'Sudah selesai — bar otomatis kembali ke announcement biasa'
  })()

  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Promo / Announcement Campaign</h2>
          <p className="text-xs text-muted-foreground">
            Campaign dengan countdown otomatis di atas navbar. Menggantikan announcement biasa saat aktif.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="promoActive" className="text-xs text-muted-foreground">Aktif</Label>
          <Switch
            id="promoActive"
            checked={form.promoActive}
            onCheckedChange={(v) => setForm({ ...form, promoActive: v })}
          />
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        <strong>Status saat ini:</strong> {phasePreview}
      </div>

      <Field label='Judul Promo (contoh: "Promo 50%")'>
        <Input
          value={form.promoTitle}
          onChange={(e) => setForm({ ...form, promoTitle: e.target.value })}
          placeholder="Promo 50%"
          maxLength={120}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tanggal & Jam Mulai (WIB)">
          <Input
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setForm({
              ...form,
              promoStartAt: wibLocalInputToUtcIso(e.target.value) || null,
            })}
          />
        </Field>
        <Field label="Tanggal & Jam Selesai (WIB)">
          <Input
            type="datetime-local"
            value={endLocal}
            onChange={(e) => setForm({
              ...form,
              promoEndAt: wibLocalInputToUtcIso(e.target.value) || null,
            })}
          />
        </Field>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Waktu disimpan dalam UTC. Input di atas diinterpretasikan sebagai Asia/Jakarta (WIB, UTC+7).
        Server memvalidasi: mulai harus lebih awal dari selesai.
      </p>

      <div className="flex items-center gap-2">
        <Switch
          id="promoCountdown"
          checked={form.promoCountdown}
          onCheckedChange={(v) => setForm({ ...form, promoCountdown: v })}
        />
        <Label htmlFor="promoCountdown" className="text-xs">
          Tampilkan countdown realtime (dd/hh/mm/ss)
        </Label>
      </div>

      <Field label='Teks Sebelum Promo (contoh: "Promo 50% mulai dalam")'>
        <Input
          value={form.promoTextBefore}
          onChange={(e) => setForm({ ...form, promoTextBefore: e.target.value })}
          placeholder="Promo 50% mulai dalam"
          maxLength={200}
        />
      </Field>

      <Field label='Teks Saat Promo Berlangsung (contoh: "🔥 Promo 50% khusus hari ini")'>
        <Input
          value={form.promoTextDuring}
          onChange={(e) => setForm({ ...form, promoTextDuring: e.target.value })}
          placeholder="🔥 Promo 50% khusus hari ini"
          maxLength={200}
        />
      </Field>

      <Field label="Link / CTA (opsional — biarkan kosong jika tidak perlu)">
        <Input
          value={form.promoLink}
          onChange={(e) => setForm({ ...form, promoLink: e.target.value })}
          placeholder="/produk atau https://..."
          maxLength={300}
        />
      </Field>
    </Card>
  )
}
