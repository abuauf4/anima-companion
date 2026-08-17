import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/SiteShell";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { buildMetadata } from "@/lib/seo";
import { getCurrentAdminUser } from "@/lib/admin-auth";
import { AdminLoginRequiredView } from "@/components/admin/AdminLoginRequiredView";

// /admin/* — admin dashboard. Catch-all route.
//
// ============================================================================
// ADMIN REALM V1 — STAGE 4 (FINAL)
// ============================================================================
// This page is now gated EXCLUSIVELY by the new admin realm auth:
//   - getCurrentAdminUser() from @/lib/admin-auth
//   - anima_admin_session cookie (NOT anima_session)
//   - AdminUser table (NOT User)
//
// The legacy customer admin fallback (customer auth + User.role === 'ADMIN')
// has been REMOVED. Legacy admins who previously logged in via /login with
// a User.role=ADMIN account must now be provisioned as AdminUser rows by
// the Developer via /admin/users (Setting User Admin).
//
// BEHAVIOR:
//   - No admin session → <AdminLoginRequiredView /> (links to /admin/login)
//   - Admin session + mustChangePassword → redirect to /admin/change-password
//   - Admin session + active → <AdminLayout section=... />
//
// All /admin/* nested routes (products, orders, settings, etc.) go through
// this same Server Component because the route is an optional catch-all.
// NOTE: /admin/login and /admin/change-password are SEPARATE static routes
// (src/app/admin/login/page.tsx, src/app/admin/change-password/page.tsx)
// and take precedence over this catch-all — they do NOT pass through here.

interface Params {
  params: Promise<{ slug?: string[] }>
}

export const metadata: Metadata = buildMetadata({
  title: "Admin",
  description: "Dashboard admin Anima Companion.",
  noIndex: true,
});

export default async function AdminPage({ params }: Params) {
  const { slug } = await params
  // The "section" matches the first segment after /admin/:
  //   /admin           → section='dashboard'
  //   /admin/products  → section='products'
  //   /admin/orders    → section='orders'
  //   /admin/users     → section='users' (Developer-only Setting User Admin)
  const section = slug?.[0] || 'dashboard'

  const admin = await getCurrentAdminUser()

  if (!admin) {
    return (
      <SiteShell admin>
        <AdminLoginRequiredView />
      </SiteShell>
    )
  }

  if (admin.mustChangePassword) {
    redirect('/admin/change-password')
  }

  return (
    <SiteShell admin>
      <AdminLayout section={section} />
    </SiteShell>
  )
}
