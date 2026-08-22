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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Search, Trash2, Package, Star, ArrowLeft, ArrowRight, Link2 } from 'lucide-react'
import { formatRupiah } from '@/lib/format'
import { toast } from 'sonner'
import { CloudinaryUploader } from '@/components/admin/CloudinaryUploader'
import { AdminActionMenu, AdminEmptyState, AdminPageHeader, AdminStatusBadge } from '@/components/admin/AdminListPrimitives'

interface AdminProductVariant {
  id: string
  productId: string
  name: string
  price: number
  salePrice: number | null
  stock: number
  isActive: boolean
  sortOrder: number
}

interface AdminProduct {
  id: string
  name: string
  slug: string
  sku: string
  brand: string
  price: number
  salePrice: number | null
  stock: number
  weight: string | null
  description: string
  benefit: string
  usage: string
  ingredients: string
  bpomNumber: string | null
  isBestSeller: boolean
  isNew: boolean
  isActive: boolean
  hasVariants: boolean
  categoryId: string
  category: { id: string; name: string; slug: string }
  images: Array<{ id: string; url: string }>
  variants: AdminProductVariant[]
  _count: { orderItems: number }
}

interface Category {
  id: string
  name: string
  slug: string
}

export function ProductsView() {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminProduct | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  // Permanent-delete confirmation modal state.
  // `permanentDeleteTarget` holds the product row the admin is about to
  // hard-delete. The AlertDialog is open iff this is non-null.
  // `permanentDeleting` blocks double-clicks + prevents closing the dialog
  // while the DELETE request is in-flight.
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<AdminProduct | null>(null)
  const [permanentDeleting, setPermanentDeleting] = useState(false)

  const load = async (q = '') => {
    setLoading(true)
    const res = await fetch(`/api/admin/products?search=${encodeURIComponent(q)}`)
    const data = await res.json()
    setProducts(data.products || [])
    setLoading(false)
  }

  const loadCategories = async () => {
    const res = await fetch('/api/admin/categories')
    const data = await res.json()
    setCategories(data.categories || [])
  }

  useEffect(() => {
    load()
    loadCategories()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load(search)
  }

  // ---- Duplicate action ------------------------------------------------
  // Shared handler for both desktop table row and mobile card menus.
  // Calls POST /api/admin/products/[id]/duplicate, which creates a NEW
  // inactive draft copy of the source product (source is never modified).
  // After success, reloads the list so the new draft appears at the top
  // (newest products sort first by createdAt desc).
  const handleDuplicate = async (product: AdminProduct) => {
    if (duplicatingId) return // prevent double-clicks
    if (
      !confirm(
        `Duplikat produk "${product.name}"?\n\n` +
          'Hasil duplikat akan dibuat sebagai nonaktif (draft). ' +
          'Produk sumber tidak akan diubah.'
      )
    ) {
      return
    }
    setDuplicatingId(product.id)
    try {
      const res = await fetch(`/api/admin/products/${product.id}/duplicate`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Gagal menduplikat produk')
      }
      toast.success('Duplikat dibuat sebagai draft nonaktif')
      await load(search)
    } catch (e: any) {
      toast.error(e.message || 'Gagal menduplikat produk')
    } finally {
      setDuplicatingId(null)
    }
  }

  // ---- Permanent delete action ----------------------------------------
  // Triggered by the 'Hapus permanen' menu item (only shown for inactive
  // products). Opens a confirmation AlertDialog. The actual DELETE request
  // is sent only after the admin confirms.
  //
  // The server route (/api/admin/products/[id]/permanent) will refuse with
  // HTTP 409 if the product has any OrderItem or Review — those represent
  // historical/transactional data that must be preserved. We surface the
  // server's error message verbatim via toast so the admin understands why
  // the delete was blocked.
  const handlePermanentDeleteConfirm = async () => {
    if (!permanentDeleteTarget) return
    if (permanentDeleting) return
    setPermanentDeleting(true)
    try {
      const res = await fetch(`/api/admin/products/${permanentDeleteTarget.id}/permanent`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // 409 = blocked by historical data (OrderItem / Review).
        // Server returns a friendly `error` string in Indonesian.
        throw new Error(data.error || 'Gagal menghapus permanen produk')
      }
      toast.success(`Produk "${permanentDeleteTarget.name}" dihapus permanen`)
      const targetId = permanentDeleteTarget.id
      setPermanentDeleteTarget(null)
      // If the deleted product was on the current page, reload to reflect
      // its absence. We pass the current search so the admin keeps their
      // filter context.
      await load(search)
      // Sanity: if targetId is still in the list after reload, something
      // went wrong server-side — surface a soft warning.
      setProducts((prev) => {
        if (prev.some((p) => p.id === targetId)) {
          toast.error('Produk masih terlihat di daftar setelah penghapusan. Muat ulang halaman.')
        }
        return prev
      })
    } catch (e: any) {
      toast.error(e.message || 'Gagal menghapus permanen produk')
    } finally {
      setPermanentDeleting(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader title="Produk" description="Kelola produk Anima Companion" action={<Button onClick={() => { setEditing(null); setDialogOpen(true) }} className="h-9 gap-2">
          <Plus className="h-4 w-4" /> Tambah Produk
        </Button>} />

      {/* Search */}
      <form onSubmit={handleSearch}>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari produk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </form>

      {/* Table */}
      <Card className="overflow-hidden rounded-xl shadow-none">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : products.length === 0 ? (
          <AdminEmptyState icon={<Package className="h-8 w-8" />} title="Belum ada produk" description="Tambahkan produk pertama untuk mulai mengelola katalog." action={<Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}><Plus className="mr-1.5 h-4 w-4" />Tambah Produk</Button>} />
        ) : (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Produk</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Kategori</th>
                  <th className="px-4 py-3 font-medium">Harga</th>
                  <th className="px-4 py-3 font-medium">Stok</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Terjual</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-border/70 transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                          {p.images[0] && (
                            <img src={p.images[0].url} alt={p.name} className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-1 font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.brand}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{p.category.name}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {p.hasVariants ? (
                        <div>
                          <p className="font-medium text-primary">
                            Mulai {formatRupiah(p.salePrice || p.price)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.variants?.length || 0} varian
                          </p>
                        </div>
                      ) : p.salePrice ? (
                        <div>
                          <p className="font-medium text-primary">{formatRupiah(p.salePrice)}</p>
                          <p className="text-xs text-muted-foreground line-through">{formatRupiah(p.price)}</p>
                        </div>
                      ) : (
                        <span className="font-medium">{formatRupiah(p.price)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={p.stock <= 5 ? 'font-semibold text-destructive' : ''}>{p.stock}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.isBestSeller && <AdminStatusBadge tone="info">Best</AdminStatusBadge>}
                        {p.isNew && <AdminStatusBadge tone="warning">Baru</AdminStatusBadge>}
                        {!p.isActive && <AdminStatusBadge>Nonaktif</AdminStatusBadge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p._count.orderItems}</td>
                    <td className="px-4 py-3 text-right">
                      <AdminActionMenu items={[
                        { label: 'Edit produk', onSelect: () => { setEditing(p); setDialogOpen(true) } },
                        { label: duplicatingId === p.id ? 'Menduplikat...' : 'Duplikat produk', onSelect: () => { handleDuplicate(p) } },
                        { label: 'Nonaktifkan', destructive: true, onSelect: async () => {
                            if (!confirm(`Nonaktifkan produk "${p.name}"?`)) return
                            await fetch(`/api/admin/products/${p.id}`, { method: 'DELETE' })
                            toast.success('Produk dinonaktifkan')
                            load(search)
                          }},
                        // Permanent hard-delete is ONLY offered on inactive
                        // products. Active products must be deactivated first
                        // — this prevents accidental hard-deletes of live
                        // catalog items.
                        ...(!p.isActive
                          ? [{ label: 'Hapus permanen', destructive: true, onSelect: () => { setPermanentDeleteTarget(p) } }]
                          : []),
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!loading && products.length > 0 && <div className="space-y-2 md:hidden">
        {products.map((p) => <Card key={`mobile-${p.id}`} className="rounded-xl p-3 shadow-none">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">{p.images[0] && <img src={p.images[0].url} alt="" className="h-full w-full object-cover" />}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-medium">{p.name}</p><p className="truncate text-[11px] text-muted-foreground">{p.brand} · {p.sku}</p></div><AdminActionMenu items={[
                { label: 'Edit produk', onSelect: () => { setEditing(p); setDialogOpen(true) } },
                { label: duplicatingId === p.id ? 'Menduplikat...' : 'Duplikat produk', onSelect: () => { handleDuplicate(p) } },
                { label: 'Nonaktifkan', destructive: true, onSelect: async () => { if (!confirm(`Nonaktifkan produk "${p.name}"?`)) return; await fetch(`/api/admin/products/${p.id}`, { method: 'DELETE' }); toast.success('Produk dinonaktifkan'); load(search) } },
                ...(!p.isActive
                  ? [{ label: 'Hapus permanen', destructive: true, onSelect: () => { setPermanentDeleteTarget(p) } }]
                  : []),
              ]} /></div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {p.hasVariants
                    ? `Mulai ${formatRupiah(p.salePrice || p.price)}`
                    : formatRupiah(p.salePrice || p.price)}
                </span>
                <span className={p.stock <= 5 ? 'text-xs font-semibold text-destructive' : 'text-xs text-muted-foreground'}>
                  Stok {p.stock}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.isActive ? <AdminStatusBadge tone="success">Aktif</AdminStatusBadge> : <AdminStatusBadge>Nonaktif</AdminStatusBadge>}
                <AdminStatusBadge>{p.category.name}</AdminStatusBadge>
                {p.hasVariants && <AdminStatusBadge tone="info">{p.variants?.length || 0} varian</AdminStatusBadge>}
              </div>
            </div>
          </div>
        </Card>)}
      </div>}

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        categories={categories}
        onSaved={() => { load(search); loadCategories() }}
      />

      {/*
        Permanent-delete confirmation modal.
        Open iff `permanentDeleteTarget` is non-null.
        While `permanentDeleting` is true, the dialog cannot be dismissed
        (Cancel button disabled, onOpenChange ignored) — this prevents the
        admin from closing mid-request and double-triggering.
      */}
      <AlertDialog
        open={permanentDeleteTarget !== null}
        onOpenChange={(open) => {
          if (permanentDeleting) return // don't allow close while in-flight
          if (!open) setPermanentDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus permanen produk?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <span className="block">
                Tindakan ini <strong className="text-foreground">tidak dapat dibatalkan</strong>.
                Produk{' '}
                <span className="font-medium text-foreground">&quot;{permanentDeleteTarget?.name}&quot;</span>{' '}
                akan dihapus beserta data gambar, relasi kategori, dan relasi masalah/kategori hewan dari database.
                <br /><br />
                File gambar fisik di Cloudinary / <code>/public/products/</code>{' '}
                <strong>tidak akan dihapus</strong> karena produk hasil duplikasi mungkin menggunakan URL gambar yang sama.
                <br /><br />
                Jika produk ini sudah pernah masuk pesanan (OrderItem) atau memiliki review, penghapusan akan{' '}
                <strong>ditolak otomatis</strong> oleh server — silakan nonaktifkan produk saja untuk mempertahankan riwayat.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={permanentDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              // Prevent the dialog from auto-closing on click — we
              // close it manually inside handlePermanentDeleteConfirm
              // only after the DELETE succeeds. This keeps the dialog
              // open (with a loading state) while the request is running.
              onClick={(e) => {
                e.preventDefault()
                handlePermanentDeleteConfirm()
              }}
              disabled={permanentDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {permanentDeleting ? 'Menghapus...' : 'Hapus permanen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ProductDialog({
  open, onOpenChange, editing, categories, onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: AdminProduct | null
  categories: Category[]
  onSaved: () => void
}) {
  // Variant editor row shape (Phase: Variants).
  // `id` is present for existing variants (loaded from DB), absent for
  // newly-added rows in this editing session. The server uses the id to
  // decide UPDATE vs CREATE, and to detect removed variants.
  interface VariantRow {
    id?: string
    name: string
    price: string
    salePrice: string
    stock: string
    isActive: boolean
  }

  const [form, setForm] = useState({
    name: '', sku: '', brand: 'Anima', price: '', salePrice: '', stock: '',
    weight: '', description: '', benefit: '', usage: '', ingredients: '',
    bpomNumber: '', isBestSeller: false, isNew: false, isActive: true,
    categoryId: '', imageUrls: [] as string[],
    // Variant support (Phase: Variants)
    hasVariants: false,
  })
  // Variants are kept in a separate state array (not inside `form`) so we
  // can mutate rows independently without re-rendering the whole form on
  // each keystroke. The `hasVariants` flag in `form` controls whether the
  // variant editor is shown and whether the parent price/stock fields are
  // editable.
  const [variantRows, setVariantRows] = useState<VariantRow[]>([])
  const [saving, setSaving] = useState(false)
  const [showManualUrl, setShowManualUrl] = useState(false)
  const [manualUrl, setManualUrl] = useState('')

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        sku: editing.sku,
        brand: editing.brand,
        price: String(editing.price),
        salePrice: editing.salePrice ? String(editing.salePrice) : '',
        stock: String(editing.stock),
        weight: editing.weight || '',
        description: editing.description,
        benefit: editing.benefit,
        usage: editing.usage,
        ingredients: editing.ingredients,
        bpomNumber: editing.bpomNumber || '',
        isBestSeller: editing.isBestSeller,
        isNew: editing.isNew,
        isActive: editing.isActive,
        categoryId: editing.categoryId,
        imageUrls: editing.images?.map((img) => img.url) || [],
        hasVariants: editing.hasVariants ?? false,
      })
      // Load existing variants into the editor. Include ALL variants
      // (active + inactive) so the admin can re-activate deactivated ones.
      setVariantRows(
        (editing.variants || []).map((v) => ({
          id: v.id,
          name: v.name,
          price: String(v.price),
          salePrice: v.salePrice ? String(v.salePrice) : '',
          stock: String(v.stock),
          isActive: v.isActive,
        }))
      )
    } else {
      setForm({
        name: '', sku: '', brand: 'Anima', price: '', salePrice: '', stock: '',
        weight: '', description: '', benefit: '', usage: '', ingredients: '',
        bpomNumber: '', isBestSeller: false, isNew: false, isActive: true,
        categoryId: categories[0]?.id || '', imageUrls: [],
        hasVariants: false,
      })
      setVariantRows([])
    }
    setShowManualUrl(false)
    setManualUrl('')
  }, [editing, open, categories])

  // ---- Variant row mutations ----
  const addVariantRow = () => {
    setVariantRows((prev) => [
      ...prev,
      // Default values for a new variant row. Admin fills in the rest.
      { name: '', price: '', salePrice: '', stock: '0', isActive: true },
    ])
  }
  const removeVariantRow = (idx: number) => {
    setVariantRows((prev) => prev.filter((_, i) => i !== idx))
  }
  const updateVariantRow = (idx: number, patch: Partial<VariantRow>) => {
    setVariantRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, ...patch } : row))
    )
  }
  const moveVariantRow = (idx: number, dir: -1 | 1) => {
    setVariantRows((prev) => {
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
      return next
    })
  }

  // ---- Toggle hasVariants ----
  // When turning ON: if there are no variant rows yet, seed one empty row
  // so the admin has a starting point. The parent price/stock fields
  // become read-only (display only) and show the derived values.
  // When turning OFF: variant rows are kept in state (so turning it back
  // ON doesn't lose them), but on save the server will soft-delete all
  // variants (because `hasVariants=false` in the payload).
  const toggleHasVariants = (next: boolean) => {
    setForm((prev) => ({ ...prev, hasVariants: next }))
    if (next && variantRows.length === 0) {
      setVariantRows([{ name: '', price: '', salePrice: '', stock: '0', isActive: true }])
    }
  }

  const addImageUrl = (url: string) => {
    if (!url) return
    setForm((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, url] }))
  }

  const removeImageUrl = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== idx),
    }))
  }

  const moveImage = (idx: number, dir: -1 | 1) => {
    setForm((prev) => {
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= prev.imageUrls.length) return prev
      const next = [...prev.imageUrls]
      ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
      return { ...prev, imageUrls: next }
    })
  }

  const setPrimary = (idx: number) => {
    // Move the chosen image to position 0 (primary = first in list).
    setForm((prev) => {
      const next = [...prev.imageUrls]
      const [item] = next.splice(idx, 1)
      next.unshift(item)
      return { ...prev, imageUrls: next }
    })
  }

  const handleSave = async () => {
    // ---- Variant-aware client-side validation ----
    // We do a quick sanity check here for better UX (instant feedback),
    // but the SERVER is the authoritative validator — it re-checks and
    // returns a 400 with a friendly message if anything is wrong. Never
    // trust the client.
    if (!form.name || !form.sku || !form.categoryId) {
      toast.error('Nama, SKU, dan kategori wajib diisi')
      return
    }
    if (!form.hasVariants && !form.price) {
      toast.error('Harga wajib diisi')
      return
    }
    if (form.hasVariants && variantRows.length === 0) {
      toast.error('Produk varian harus memiliki minimal 1 varian')
      return
    }

    setSaving(true)
    try {
      // Build the request body. When hasVariants=true, we send the variants
      // array (with id for existing rows) and DO NOT send parent price/stock
      // — the server derives them. When hasVariants=false, we send parent
      // price/stock as before (backward compatible).
      const body: Record<string, unknown> = {
        name: form.name,
        sku: form.sku,
        brand: form.brand,
        weight: form.weight,
        description: form.description,
        benefit: form.benefit,
        usage: form.usage,
        ingredients: form.ingredients,
        bpomNumber: form.bpomNumber,
        isBestSeller: form.isBestSeller,
        isNew: form.isNew,
        isActive: form.isActive,
        categoryId: form.categoryId,
        images: form.imageUrls.filter(Boolean),
        hasVariants: form.hasVariants,
      }
      if (form.hasVariants) {
        body.variants = variantRows.map((v, i) => ({
          id: v.id || undefined,
          name: v.name,
          price: v.price,
          salePrice: v.salePrice || null,
          stock: v.stock,
          isActive: v.isActive,
          sortOrder: i,
        }))
      } else {
        body.price = parseInt(form.price)
        body.salePrice = form.salePrice ? parseInt(form.salePrice) : null
        body.stock = parseInt(form.stock) || 0
      }

      const url = editing ? `/api/admin/products/${editing.id}` : '/api/admin/products'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Gagal menyimpan')
      }
      toast.success(editing ? 'Produk diperbarui' : 'Produk ditambahkan')
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
      <DialogContent className="top-4 flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] min-w-0 translate-y-0 flex-col gap-3 overflow-hidden p-4 sm:top-[50%] sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-2xl sm:translate-y-[-50%] sm:gap-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Perbarui informasi produk' : 'Isi data produk baru'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden py-1 pr-1">
          <div className="border-b border-border/70 pb-2">
            <h3 className="text-sm font-semibold">Informasi Produk</h3>
            <p className="text-xs text-muted-foreground">Identitas utama yang tampil di katalog.</p>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="col-span-1 min-w-0 sm:col-span-2">
              <Label>Nama Produk <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>SKU <span className="text-destructive">*</span></Label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>Brand</Label>
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="mt-1.5" />
            </div>
            <div>
              <Label>Kategori <span className="text-destructive">*</span></Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Berat/Isi</Label>
              <Input value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="Mis. 60 tablet" className="mt-1.5" />
            </div>
            {/* ---- Price / stock fields ----
              When hasVariants=true, these become READ-ONLY displays of the
              derived parent cache (lowest effective price + sum stock). The
              admin edits variants in the Variant Editor section below.
              When hasVariants=false, these are the normal editable fields
              (backward compatible). */}
            {!form.hasVariants ? (
              <>
                <div>
                  <Label>Harga (Rp) <span className="text-destructive">*</span></Label>
                  <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1.5" />
                </div>
                <div>
                  <Label>Harga Sale (opsional)</Label>
                  <Input type="number" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} className="mt-1.5" />
                </div>
                <div>
                  <Label>Stok</Label>
                  <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="mt-1.5" />
                </div>
              </>
            ) : (
              <div className="col-span-1 sm:col-span-2">
                <div className="rounded-md border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Harga & stok produk ini diatur per varian.</p>
                  <p className="mt-1">
                    Harga tampil di katalog = harga termurah dari varian aktif. Stok total = jumlah stok semua varian aktif. Kedua nilai dihitung otomatis dari tabel varian di bawah.
                  </p>
                  {/* Show the derived values for transparency, but read-only. */}
                  <div className="mt-2 flex flex-wrap gap-3">
                    <span>
                      Harga tampil:{' '}
                      <strong className="text-foreground">
                        {(() => {
                          const active = variantRows.filter((v) => v.isActive && v.price)
                          if (active.length === 0) return '—'
                          const effs = active.map((v) => {
                            const p = parseInt(v.price) || 0
                            const sp = v.salePrice ? parseInt(v.salePrice) : null
                            return sp && sp < p ? sp : p
                          })
                          return formatRupiah(Math.min(...effs))
                        })()}
                      </strong>
                    </span>
                    <span>
                      Stok total:{' '}
                      <strong className="text-foreground">
                        {variantRows
                          .filter((v) => v.isActive)
                          .reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="border-b border-border/70 pb-2 pt-2">
              <h3 className="text-sm font-semibold">Media & Deskripsi</h3>
              <p className="text-xs text-muted-foreground">Lengkapi visual dan informasi pendukung produk.</p>
            </div>
            <div className="col-span-1 grid min-w-0 grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2">
            <div className="col-span-1 min-w-0 sm:col-span-2">
              <Label>Gambar Produk</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Gambar pertama adalah <strong>gambar utama</strong> di product card & detail.
                Upload langsung dari komputer/HP, atau tempel URL gambar manual.
                Gambar lama tetap dipertahankan saat edit kecuali dihapus.
              </p>

              {/* Preview grid */}
              {form.imageUrls.length > 0 && (
                <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {form.imageUrls.map((url, idx) => (
                    <li
                      key={`${idx}-${url}`}
                      className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
                    >
                      {/* Admin preview thumbnail — plain <img> is intentional:
                          next/image optimization has no value for a 96x96 admin preview. */}
                      <img
                        src={url}
                        alt={`Gambar ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                      {idx === 0 && (
                        <Badge
                          className="absolute left-1 top-1 gap-0.5 px-1 py-0 text-[9px] shadow-sm"
                        >
                          <Star className="size-2.5 fill-current" /> Utama
                        </Badge>
                      )}
                      {/* Action bar */}
                      <div className="absolute inset-x-0 bottom-0 flex justify-between gap-0.5 bg-black/60 px-1 py-1 opacity-0 transition group-hover:opacity-100">
                        <div className="flex gap-0.5">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-white hover:bg-white/20"
                            disabled={idx === 0}
                            onClick={() => moveImage(idx, -1)}
                            title="Geser kiri"
                          >
                            <ArrowLeft className="size-3" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-white hover:bg-white/20"
                            disabled={idx === form.imageUrls.length - 1}
                            onClick={() => moveImage(idx, 1)}
                            title="Geser kanan"
                          >
                            <ArrowRight className="size-3" />
                          </Button>
                        </div>
                        <div className="flex gap-0.5">
                          {idx !== 0 && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-white hover:bg-white/20"
                              onClick={() => setPrimary(idx)}
                              title="Jadikan utama"
                            >
                              <Star className="size-3" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-red-300 hover:bg-red-500/40 hover:text-white"
                            onClick={() => removeImageUrl(idx)}
                            title="Hapus"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Uploader */}
              <div className="mt-3 min-w-0">
                <CloudinaryUploader
                  onUploaded={addImageUrl}
                  disabled={saving}
                />
              </div>

              {/* Manual URL fallback (collapsed by default) */}
              <div className="mt-2">
                {!showManualUrl ? (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-muted-foreground"
                    onClick={() => setShowManualUrl(true)}
                  >
                    <Link2 className="size-3" /> Tambah URL gambar manual (lanjutan)
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
                    <Input
                      placeholder="https://... atau /products/slug/01.webp"
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                      className="flex-1 font-mono text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (manualUrl.trim()) {
                            addImageUrl(manualUrl.trim())
                            setManualUrl('')
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (manualUrl.trim()) {
                          addImageUrl(manualUrl.trim())
                          setManualUrl('')
                        }
                      }}
                    >
                      Tambah
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowManualUrl(false)}
                    >
                      Tutup
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-1 min-w-0 sm:col-span-2">
              <Label>No. BPOM</Label>
              <Input value={form.bpomNumber} onChange={(e) => setForm({ ...form, bpomNumber: e.target.value })} placeholder="BPOM TR XXXXXXXXXXXX" className="mt-1.5" />
            </div>
            <div className="col-span-1 min-w-0 sm:col-span-2">
              <Label>Deskripsi</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1.5" />
            </div>
            <div className="col-span-1 min-w-0 sm:col-span-2">
              <Label>Manfaat</Label>
              <Textarea value={form.benefit} onChange={(e) => setForm({ ...form, benefit: e.target.value })} rows={2} className="mt-1.5" />
            </div>
            <div className="col-span-1 min-w-0 sm:col-span-2">
              <Label>Cara Pakai</Label>
              <Textarea value={form.usage} onChange={(e) => setForm({ ...form, usage: e.target.value })} rows={2} className="mt-1.5" />
            </div>
            <div className="col-span-1 min-w-0 sm:col-span-2">
              <Label>Kandungan</Label>
              <Textarea value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} rows={2} className="mt-1.5" />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 border-t border-border pt-4">
            <label className="flex min-h-10 items-center gap-3 rounded-lg border border-border/70 px-3 text-sm">
              <Switch checked={form.isBestSeller} onCheckedChange={(v) => setForm({ ...form, isBestSeller: v })} />
              Best Seller
            </label>
            <label className="flex min-h-10 items-center gap-3 rounded-lg border border-border/70 px-3 text-sm">
              <Switch checked={form.isNew} onCheckedChange={(v) => setForm({ ...form, isNew: v })} />
              Produk Baru
            </label>
            <label className="flex min-h-10 items-center gap-3 rounded-lg border border-border/70 px-3 text-sm">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              Aktif
            </label>
          </div>

          {/* ============ Variant Editor (Phase: Variants) ============ */}
          {/*
            Toggle: "Produk memiliki varian"
            When ON: render stacked-card variant editor below.
            When OFF: hidden. Parent price/stock fields above are editable.

            Mobile UX: stacked cards (one card per variant), each card has
            its own Name / Price / SalePrice / Stock / Active toggle /
            remove / move-up / move-down buttons. This avoids the cramped
            horizontal-table UX on small screens.
          */}
          <div className="border-t border-border pt-4">
            <label className="flex min-h-10 items-center gap-3 rounded-lg border border-border/70 px-3 text-sm">
              <Switch
                checked={form.hasVariants}
                onCheckedChange={toggleHasVariants}
                disabled={saving}
              />
              <span>
                Produk memiliki varian
                <span className="ml-1 text-xs text-muted-foreground">
                  (mis. 10 kapsul, 30 kapsul, 60 ml)
                </span>
              </span>
            </label>

            {form.hasVariants && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold">Varian Produk</h4>
                    <p className="text-xs text-muted-foreground">
                      Setiap varian punya nama, harga, dan stok sendiri. Nama varian harus unik.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addVariantRow}
                    disabled={saving}
                    className="gap-1"
                  >
                    <Plus className="size-3.5" /> Tambah Varian
                  </Button>
                </div>

                {variantRows.length === 0 && (
                  <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                    Belum ada varian. Klik "Tambah Varian" untuk membuat varian pertama.
                  </div>
                )}

                {variantRows.map((row, idx) => (
                  <div
                    key={row.id || `new-${idx}`}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    {/* Row header: index + active toggle + move/remove */}
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Varian #{idx + 1}
                        {row.id && <span className="ml-1 font-mono text-[10px]">({row.id.slice(-6)})</span>}
                      </span>
                      <div className="flex items-center gap-1">
                        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Switch
                            checked={row.isActive}
                            onCheckedChange={(v) => updateVariantRow(idx, { isActive: v })}
                            disabled={saving}
                            className="scale-75"
                          />
                          Aktif
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={idx === 0 || saving}
                          onClick={() => moveVariantRow(idx, -1)}
                          title="Naik"
                        >
                          <ArrowLeft className="size-3 rotate-90" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={idx === variantRows.length - 1 || saving}
                          onClick={() => moveVariantRow(idx, 1)}
                          title="Turun"
                        >
                          <ArrowRight className="size-3 rotate-90" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={saving}
                          onClick={() => removeVariantRow(idx)}
                          title="Hapus varian"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                    {/* Fields: stacked on mobile, 2x2 grid on sm+ */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <Label className="text-[10px]">Nama Varian <span className="text-destructive">*</span></Label>
                        <Input
                          value={row.name}
                          onChange={(e) => updateVariantRow(idx, { name: e.target.value })}
                          placeholder="Mis. 30 kapsul"
                          disabled={saving}
                          className="mt-1 h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Harga (Rp) <span className="text-destructive">*</span></Label>
                        <Input
                          type="number"
                          value={row.price}
                          onChange={(e) => updateVariantRow(idx, { price: e.target.value })}
                          placeholder="85000"
                          disabled={saving}
                          className="mt-1 h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Harga Diskon</Label>
                        <Input
                          type="number"
                          value={row.salePrice}
                          onChange={(e) => updateVariantRow(idx, { salePrice: e.target.value })}
                          placeholder="opsional"
                          disabled={saving}
                          className="mt-1 h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">Stok</Label>
                        <Input
                          type="number"
                          value={row.stock}
                          onChange={(e) => updateVariantRow(idx, { stock: e.target.value })}
                          placeholder="0"
                          disabled={saving}
                          className="mt-1 h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border/70 pt-3 sm:border-0 sm:pt-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah Produk'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
