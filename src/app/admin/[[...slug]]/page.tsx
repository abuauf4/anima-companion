import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminGate } from "@/components/layout/AuthGate";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/auth";
import { LoginRequiredView, UnauthorizedView } from "@/components/layout/AuthViews";

// /admin/* — admin dashboard. Catch-all route.
//
// Server-side authorization (task: "Admin isolation and full functional audit"):
//   - The page is a Server Component, so we call getCurrentUser() here at
//     request time. The cookie is HMAC-signed and re-verified against the
//     database on every request (see src/lib/auth.ts -> getCurrentUser),
//     so an anonymous visitor or a non-admin authenticated customer
//     cannot reach <AdminLayout> on the server. This complements the
//     requireAdmin() guard already present in every /api/admin/* handler,
//     so mutations are also fully server-side protected.
//   - The client-side <AdminGate> wrapper below is kept as a thin
//     additional safety net (it is harmless) but is no longer the only
//     line of defense.
//
// Behavior:
//   - Anonymous visitor → <LoginRequiredView /> (link to /login)
//   - Authenticated non-admin → <UnauthorizedView />
//   - Authenticated admin → <AdminLayout section=... />
//
// All /admin/* nested routes (products, orders, settings, etc.) go through
// this same Server Component because the route is an optional catch-all.

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
  const section = slug?.[0] || 'dashboard'

  // Server-side admin role guard. Re-fetches the user from the database
  // (cookie is HMAC-verified, payload.userId is checked against the live
  // User row, role is read from the row — not from the cookie payload).
  const user = await getCurrentUser()

  if (!user) {
    return (
      <SiteShell>
        <LoginRequiredView />
      </SiteShell>
    )
  }

  if (user.role !== 'ADMIN') {
    return (
      <SiteShell>
        <UnauthorizedView />
      </SiteShell>
    )
  }

  return (
    <SiteShell>
      <AdminGate>
        <AdminLayout section={section} />
      </AdminGate>
    </SiteShell>
  )
}
