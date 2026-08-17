import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SiteShell } from '@/components/layout/SiteShell'
import { AdminChangePasswordView } from '@/views/admin/AdminChangePasswordView'
import { buildMetadata } from '@/lib/seo'
import { getCurrentAdminUser } from '@/lib/admin-auth'

// /admin/change-password — Own-password change for the internal admin realm.
//
// This route serves TWO flows:
//   1. First-login forced change: the admin was created by the Developer
//      with a temp password (mustChangePassword === true). They are
//      redirected here immediately after /admin/login and CANNOT reach
//      any other /admin/* route until they set a new password.
//   2. Voluntary change: the admin is already in the panel and wants to
//      rotate their password. They navigate here from the sidebar.
//
// If no admin session is present, redirect to /admin/login.
//
// noIndex — never appear in search results.

export const metadata: Metadata = buildMetadata({
  title: 'Ganti Password Admin',
  description: 'Ganti password admin internal Anima Companion.',
  noIndex: true,
})

export default async function AdminChangePasswordPage() {
  const admin = await getCurrentAdminUser()
  if (!admin) {
    redirect('/admin/login')
  }

  // Pass mustChangePassword to the view so it can show the forced-change
  // banner (vs the voluntary-change heading).
  return (
    <SiteShell admin>
      <AdminChangePasswordView
        mustChangePassword={admin.mustChangePassword}
        displayName={admin.displayName}
      />
    </SiteShell>
  )
}
