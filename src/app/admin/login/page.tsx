import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SiteShell } from '@/components/layout/SiteShell'
import { AdminLoginView } from '@/views/admin/AdminLoginView'
import { buildMetadata } from '@/lib/seo'
import { getCurrentAdminUser } from '@/lib/admin-auth'

// /admin/login — Internal admin realm login (Username + Password).
//
// COMPLETELY SEPARATE from customer /login:
//   - No Google OAuth button, no OTP, no Register link, no Forgot-password link.
//   - Authenticates against AdminUser (NOT User).
//   - Sets anima_admin_session cookie (NOT anima_session).
//
// If the visitor already has a valid admin session, redirect away:
//   - mustChangePassword === true  → /admin/change-password
//   - mustChangePassword === false → /admin (or ?next= if safe)
//
// noIndex — admin login must never appear in search results.

export const metadata: Metadata = buildMetadata({
  title: 'Admin Masuk',
  description: 'Login admin internal Anima Companion.',
  noIndex: true,
})

interface SearchParams {
  searchParams: Promise<{ next?: string }>
}

export default async function AdminLoginPage({ searchParams }: SearchParams) {
  const { next } = await searchParams

  // If already authenticated as admin, redirect away.
  const admin = await getCurrentAdminUser()
  if (admin) {
    if (admin.mustChangePassword) {
      redirect('/admin/change-password')
    }
    redirect(next && next.startsWith('/admin') ? next : '/admin')
  }

  return (
    <SiteShell>
      <AdminLoginView next={next} />
    </SiteShell>
  )
}
