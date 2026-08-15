'use client'

import { Button } from '@/components/ui/button'
import { ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'

// ============================================================================
// AdminLoginRequiredView — shown when an anonymous visitor hits /admin/*.
//
// DIFFERENT from the customer LoginRequiredView:
//   - Links to /admin/login (NOT /login)
//   - Uses the ShieldCheck icon (admin realm)
//   - Mentions "admin internal" to distinguish from customer login
//
// This is a client component so the button can use router.push for
// client-side navigation to /admin/login.
// ============================================================================

export function AdminLoginRequiredView() {
  const router = useRouter()
  return (
    <div className="container-page flex min-h-[60vh] items-center justify-center py-10">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl gradient-brand text-white">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold">Akses Admin Diperlukan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Anda harus login sebagai admin internal untuk mengakses halaman ini.
        </p>
        <Button
          className="mt-6"
          size="lg"
          onClick={() => router.push('/admin/login')}
        >
          Masuk Admin
        </Button>
      </div>
    </div>
  )
}
