'use client'

import { useEffect, useState, useMemo } from 'react'
import { useHashRouter } from '@/lib/router'
import { ProductCard } from '@/components/product/ProductCard'
import { Product, Category, PetType, Problem } from '@/hooks/use-fetch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ChevronLeft, ChevronRight, SlidersHorizontal, X, Search } from 'lucide-react'

interface ShopFilters {
  search: string
  category: string
  problem: string
  petType: string
  brand: string
  sort: string
  page: number
}

interface FilterPanelProps {
  categories: Category[]
  problems: Problem[]
  petTypes: PetType[]
  filters: ShopFilters
  updateFilter: (key: string, value: string) => void
}

function FilterPanel({ categories, problems, petTypes, filters, updateFilter }: FilterPanelProps) {
  return (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kategori</h3>
        <div className="space-y-1">
          <button
            onClick={() => updateFilter('category', '')}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent ${
              !filters.category ? 'bg-accent font-medium text-primary' : ''
            }`}
          >
            Semua Kategori
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => updateFilter('category', c.slug)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent ${
                filters.category === c.slug ? 'bg-accent font-medium text-primary' : ''
              }`}
            >
              {c.name}
              {c._count && (
                <span className="text-xs text-muted-foreground">{c._count.products}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Problems */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manfaat</h3>
        <div className="flex flex-wrap gap-2">
          {problems.map((p) => (
            <button
              key={p.id}
              onClick={() => updateFilter('problem', filters.problem === p.slug ? '' : p.slug)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filters.problem === p.slug
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent text-foreground hover:bg-accent/80'
              }`}
              style={!filters.problem || filters.problem !== p.slug ? { color: p.color || undefined } : undefined}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Pet types */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jenis Hewan</h3>
        <div className="space-y-1">
          <button
            onClick={() => updateFilter('petType', '')}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent ${
              !filters.petType ? 'bg-accent font-medium text-primary' : ''
            }`}
          >
            Semua Hewan
          </button>
          {petTypes.map((p) => (
            <button
              key={p.id}
              onClick={() => updateFilter('petType', p.slug)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent ${
                filters.petType === p.slug ? 'bg-accent font-medium text-primary' : ''
              }`}
            >
              {p.name}
              {p._count && (
                <span className="text-xs text-muted-foreground">{p._count.products}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ShopView() {
  const { route, navigate } = useHashRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [categories, setCategories] = useState<Category[]>([])
  const [petTypes, setPetTypes] = useState<PetType[]>([])
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)
  const [localSearch, setLocalSearch] = useState('')

  // Sync filters from URL — supports both legacy (petType) and new (pet, brand) aliases
  const filters = useMemo<ShopFilters>(() => {
    const q = route.query
    return {
      search: q.get('search') || '',
      category: q.get('category') || '',
      problem: q.get('problem') || '',
      petType: q.get('petType') || q.get('pet') || '',
      brand: q.get('brand') || q.get('seller') || '',
      sort: q.get('sort') || 'popular',
      page: parseInt(q.get('page') || '1'),
    }
  }, [route.query])

  // Sync local search input when URL search changes
  useEffect(() => {
     
    setLocalSearch(filters.search)
  }, [filters.search])

  // Load sidebar filter data
  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/pet-types').then((r) => r.json()),
      fetch('/api/problems').then((r) => r.json()),
    ]).then(([c, pt, p]) => {
      setCategories(c.categories || [])
      setPetTypes(pt.petTypes || [])
      setProblems(p.problems || [])
    })
  }, [])

  useEffect(() => {
     
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.search) params.set('search', filters.search)
    if (filters.category) params.set('category', filters.category)
    if (filters.problem) params.set('problem', filters.problem)
    if (filters.petType) params.set('petType', filters.petType)
    if (filters.brand) params.set('brand', filters.brand)
    if (filters.sort) params.set('sort', filters.sort)
    params.set('page', String(filters.page))
    params.set('limit', '12')

    fetch(`/api/products?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setProducts(data.products || [])
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 })
      })
      .finally(() => setLoading(false))
  }, [filters])

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(route.query.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    if (key !== 'page') params.delete('page')
    navigate(`/shop?${params.toString()}`)
  }

  const activeFilterCount = [
    filters.category,
    filters.problem,
    filters.petType,
    filters.search,
  ].filter(Boolean).length

  // Compute display title
  const displayTitle = useMemo(() => {
    if (filters.problem) {
      const p = problems.find((x) => x.slug === filters.problem)
      return p ? `Produk untuk ${p.name}` : 'Belanja by Manfaat'
    }
    if (filters.petType) {
      const p = petTypes.find((x) => x.slug === filters.petType)
      return p ? `Produk untuk ${p.name}` : 'Belanja by Hewan'
    }
    if (filters.category) {
      const c = categories.find((x) => x.slug === filters.category)
      return c ? c.name : 'Belanja'
    }
    if (filters.search) return `Hasil pencarian: "${filters.search}"`
    return 'Semua Produk Anima Companion'
  }, [filters, problems, petTypes, categories])

  return (
    <div className="container-page py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold md:text-3xl">{displayTitle}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {loading ? 'Memuat...' : `${pagination.total} produk ditemukan`}
        </p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar - desktop */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1 [scrollbar-width:thin]">
            <FilterPanel
              categories={categories}
              problems={problems}
              petTypes={petTypes}
              filters={filters}
              updateFilter={updateFilter}
            />
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-4 w-full"
                onClick={() => navigate('/shop')}
              >
                <X className="mr-1 h-4 w-4" /> Reset Filter
              </Button>
            )}
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-border pb-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filter
                  {activeFilterCount > 0 && (
                    <Badge className="ml-1 h-5 min-w-[20px] px-1 text-[10px]">{activeFilterCount}</Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filter Produk</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <FilterPanel
                    categories={categories}
                    problems={problems}
                    petTypes={petTypes}
                    filters={filters}
                    updateFilter={updateFilter}
                  />
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => navigate('/shop')}
                    >
                      <X className="mr-1 h-4 w-4" /> Reset Filter
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <div className="relative flex-1 max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari produk..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') updateFilter('search', localSearch)
                }}
                className="pl-9"
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-sm text-muted-foreground sm:inline">Urutkan:</span>
              <Select value={filters.sort} onValueChange={(v) => updateFilter('sort', v)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">Populer</SelectItem>
                  <SelectItem value="newest">Terbaru</SelectItem>
                  <SelectItem value="price-asc">Harga Terendah</SelectItem>
                  <SelectItem value="price-desc">Harga Tertinggi</SelectItem>
                  <SelectItem value="rating">Rating Tertinggi</SelectItem>
                  <SelectItem value="name">Nama A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {filters.search && (
                <Badge variant="secondary" className="gap-1">
                  &quot;{filters.search}&quot;
                  <button onClick={() => updateFilter('search', '')}><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {filters.category && (
                <Badge variant="secondary" className="gap-1">
                  {categories.find((c) => c.slug === filters.category)?.name}
                  <button onClick={() => updateFilter('category', '')}><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {filters.problem && (
                <Badge variant="secondary" className="gap-1">
                  {problems.find((p) => p.slug === filters.problem)?.name}
                  <button onClick={() => updateFilter('problem', '')}><X className="h-3 w-3" /></button>
                </Badge>
              )}
              {filters.petType && (
                <Badge variant="secondary" className="gap-1">
                  {petTypes.find((p) => p.slug === filters.petType)?.name}
                  <button onClick={() => updateFilter('petType', '')}><X className="h-3 w-3" /></button>
                </Badge>
              )}
            </div>
          )}

          {/* Products grid — 2 cols mobile, 3 cols tablet, 4 cols desktop */}
          {loading ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-lg border border-border/60 bg-card">
                  <Skeleton className="aspect-square rounded-none" />
                  <div className="space-y-1.5 p-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 text-5xl">🔍</div>
              <h3 className="mb-1 text-lg font-semibold">Produk tidak ditemukan</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Coba ubah filter atau kata kunci pencarian
              </p>
              <Button onClick={() => navigate('/shop')}>Reset Filter</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={filters.page <= 1}
                onClick={() => updateFilter('page', String(filters.page - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: pagination.totalPages }).map((_, i) => {
                const page = i + 1
                if (page === 1 || page === pagination.totalPages || Math.abs(page - filters.page) <= 1) {
                  return (
                    <Button
                      key={page}
                      variant={page === filters.page ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => updateFilter('page', String(page))}
                    >
                      {page}
                    </Button>
                  )
                }
                if (Math.abs(page - filters.page) === 2) {
                  return <span key={page} className="px-1">...</span>
                }
                return null
              })}
              <Button
                variant="outline"
                size="icon"
                disabled={filters.page >= pagination.totalPages}
                onClick={() => updateFilter('page', String(filters.page + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
