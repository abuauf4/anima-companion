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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Search, Trash2, Package } from 'lucide-react'
import { formatRupiah, effectivePrice } from '@/lib/format'
import { toast } from 'sonner'

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
  categoryId: string
  category: { id: string; name: string; slug: string }
  images: Array<{ id: string; url: string }>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produk</h1>
          <p className="text-sm text-muted-foreground">Kelola produk Anima Companion</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true) }} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah Produk
        </Button>
      </div>

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
      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-sm font-medium">Belum ada produk</p>
            <p className="text-xs text-muted-foreground">Klik "Tambah Produk" untuk menambahkan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-accent/50">
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
                  <tr key={p.id} className="border-t border-border hover:bg-accent/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                          {p.images[0] && (
                            // eslint-disable-next-line @next/next/no-img-element
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
                      {p.salePrice ? (
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
                        {p.isBestSeller && <Badge className="text-[9px] bg-primary">Best</Badge>}
                        {p.isNew && <Badge className="text-[9px] bg-secondary">Baru</Badge>}
                        {!p.isActive && <Badge variant="secondary" className="text-[9px]">Nonaktif</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p._count.orderItems}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => { setEditing(p); setDialogOpen(true) }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={async () => {
                            if (!confirm(`Nonaktifkan produk "${p.name}"?`)) return
                            await fetch(`/api/admin/products/${p.id}`, { method: 'DELETE' })
                            toast.success('Produk dinonaktifkan')
                            load(search)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        categories={categories}
        onSaved={() => { load(search); loadCategories() }}
      />
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
  const [form, setForm] = useState({
    name: '', sku: '', brand: 'Anima', price: '', salePrice: '', stock: '',
    weight: '', description: '', benefit: '', usage: '', ingredients: '',
    bpomNumber: '', isBestSeller: false, isNew: false, isActive: true,
    categoryId: '', imageUrl: '',
  })
  const [saving, setSaving] = useState(false)

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
        imageUrl: editing.images[0]?.url || '',
      })
    } else {
      setForm({
        name: '', sku: '', brand: 'Anima', price: '', salePrice: '', stock: '',
        weight: '', description: '', benefit: '', usage: '', ingredients: '',
        bpomNumber: '', isBestSeller: false, isNew: false, isActive: true,
        categoryId: categories[0]?.id || '', imageUrl: '',
      })
    }
  }, [editing, open, categories])

  const handleSave = async () => {
    if (!form.name || !form.sku || !form.price || !form.categoryId) {
      toast.error('Nama, SKU, harga, dan kategori wajib diisi')
      return
    }
    setSaving(true)
    try {
      const body = {
        ...form,
        price: parseInt(form.price),
        salePrice: form.salePrice ? parseInt(form.salePrice) : null,
        stock: parseInt(form.stock) || 0,
        images: form.imageUrl ? [form.imageUrl] : [],
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Perbarui informasi produk' : 'Isi data produk baru'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
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
            <div className="col-span-2">
              <Label>URL Gambar</Label>
              <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." className="mt-1.5" />
              <p className="mt-1 text-xs text-muted-foreground">Tip: gunakan https://placehold.co/600x600 untuk placeholder</p>
            </div>
            <div className="col-span-2">
              <Label>No. BPOM</Label>
              <Input value={form.bpomNumber} onChange={(e) => setForm({ ...form, bpomNumber: e.target.value })} placeholder="BPOM TR XXXXXXXXXXXX" className="mt-1.5" />
            </div>
            <div className="col-span-2">
              <Label>Deskripsi</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1.5" />
            </div>
            <div className="col-span-2">
              <Label>Manfaat</Label>
              <Textarea value={form.benefit} onChange={(e) => setForm({ ...form, benefit: e.target.value })} rows={2} className="mt-1.5" />
            </div>
            <div className="col-span-2">
              <Label>Cara Pakai</Label>
              <Textarea value={form.usage} onChange={(e) => setForm({ ...form, usage: e.target.value })} rows={2} className="mt-1.5" />
            </div>
            <div className="col-span-2">
              <Label>Kandungan</Label>
              <Textarea value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} rows={2} className="mt-1.5" />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 border-t border-border pt-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.isBestSeller} onCheckedChange={(v) => setForm({ ...form, isBestSeller: v })} />
              Best Seller
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.isNew} onCheckedChange={(v) => setForm({ ...form, isNew: v })} />
              Produk Baru
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              Aktif
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah Produk'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
