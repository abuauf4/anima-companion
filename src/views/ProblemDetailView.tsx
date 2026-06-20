'use client'

import { useEffect, useState } from 'react'
import { useHashRouter } from '@/lib/router'
import { Product, Problem } from '@/hooks/use-fetch'
import { ProductCard } from '@/components/product/ProductCard'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronRight, Shield, Utensils, Sparkles, Bone, Activity, Eye, Heart, Sun, MessageCircle } from 'lucide-react'
import { whatsappAdminUrl } from '@/lib/config'

const PROBLEM_ICONS: Record<string, any> = {
  imunitas: Shield,
  'nafsu-makan': Utensils,
  'bulu-dan-kulit': Sparkles,
  'tulang-dan-sendi': Bone,
  pencernaan: Activity,
  mata: Eye,
  recovery: Heart,
  harian: Sun,
}

export function ProblemDetailView({ slug }: { slug: string }) {
  const { navigate } = useHashRouter()
  const [data, setData] = useState<{ problem: Problem; products: Product[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/problems?slug=${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error('not found')
        return r.json()
      })
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="container-page py-6">
        <Skeleton className="mb-6 h-32 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-[3/4] rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 text-5xl">🤔</div>
        <h1 className="mb-2 text-2xl font-bold">Kategori Tidak Ditemukan</h1>
        <button onClick={() => navigate('/problem')} className="text-primary hover:underline">
          Lihat semua kategori
        </button>
      </div>
    )
  }

  const { problem, products } = data
  const Icon = PROBLEM_ICONS[problem.slug] || Activity

  return (
    <div className="container-page py-6">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <button onClick={() => navigate('/')} className="hover:text-primary">Beranda</button>
        <ChevronRight className="h-3 w-3" />
        <button onClick={() => navigate('/problem')} className="hover:text-primary">Shop by Problem</button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{problem.name}</span>
      </nav>

      {/* Header */}
      <Card
        className="mb-8 overflow-hidden p-6 md:p-8"
        style={{
          background: `linear-gradient(135deg, ${(problem.color || '#888')}15 0%, ${(problem.color || '#888')}05 100%)`,
          borderTopColor: problem.color || undefined,
          borderTopWidth: 4,
        }}
      >
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:gap-6">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: (problem.color || '#888') + '20',
              color: problem.color || '#888',
            }}
          >
            <Icon className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <Badge className="mb-2" style={{ backgroundColor: (problem.color || '#888') + '20', color: problem.color || '#888' }}>
              Kategori Masalah
            </Badge>
            <h1 className="text-2xl font-bold md:text-3xl">{problem.name}</h1>
            {problem.description && (
              <p className="mt-1 text-sm text-muted-foreground">{problem.description}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {products.length} produk tersedia untuk kategori ini
            </p>
          </div>
          <a
            href={whatsappAdminUrl(`Halo Anima Companion! Hewan saya ada masalah ${problem.name.toLowerCase()}. Mau konsultasi produk yang tepat 🐾`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <button className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-success-foreground hover:bg-success/90">
              <MessageCircle className="h-4 w-4" /> Konsultasi
            </button>
          </a>
        </div>
      </Card>

      {/* Products */}
      {products.length === 0 ? (
        <div className="py-20 text-center">
          <div className="mb-4 text-5xl">📭</div>
          <p className="text-muted-foreground">Belum ada produk untuk kategori ini</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
