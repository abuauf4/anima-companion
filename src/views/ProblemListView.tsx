'use client'

import { useEffect, useState } from 'react'
import { useHashRouter } from '@/lib/router'
import { Problem } from '@/hooks/use-fetch'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronRight } from 'lucide-react'
import {
  Shield, Utensils, Sparkles, Bone, Activity, Eye, Heart, Sun,
} from 'lucide-react'

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

export function ProblemListView() {
  const { navigate } = useHashRouter()
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/problems')
      .then((r) => r.json())
      .then((d) => setProblems(d.problems || []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="container-page py-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold md:text-3xl">Shop by Problem</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Pilih masalah kesehatan hewan peliharaan Anda untuk menemukan produk yang tepat.
          Setiap kategori berisi produk pilihan yang diformulasikan khusus.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {problems.map((p) => {
            const Icon = PROBLEM_ICONS[p.slug] || Activity
            return (
              <Card
                key={p.id}
                className="group cursor-pointer p-6 transition-all hover:shadow-md"
                onClick={() => navigate(`/problem/${p.slug}`)}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:scale-110"
                    style={{
                      backgroundColor: (p.color || '#888') + '20',
                      color: p.color || '#888',
                    }}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold">{p.name}</h3>
                    {p._count && (
                      <p className="text-xs text-muted-foreground">{p._count.products} produk tersedia</p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
                {p.description && (
                  <p className="mt-4 text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
