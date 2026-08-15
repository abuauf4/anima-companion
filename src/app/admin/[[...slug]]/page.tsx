import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/SiteShell";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminGate } from "@/components/layout/AuthGate";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentAdminUser } from "@/lib/admin-auth";
import { LoginRequiredView, UnauthorizedView } from "@/components/layout/AuthViews";

// /admin/* — admin dashboard. Catch-all route.
//
// ============================================================================
// DUAL-AUTH TRANSITION STATE (Admin Realm V1, Stage 2 → Stage 4)
// ============================================================================
// This page accepts EITHER of two admin auth realms during the transition:
//
//   1. NEW admin realm (AdminUser + anima_admin_session cookie):
//      - Authenticates via /admin/login (username + password).
//      - Verified by getCurrentAdminUser() from @/lib/admin-auth.
//      - If mustChangePassword === true → redirect to /admin/change-password.
//      - Otherwise → render <AdminLayout /> directly (no AdminGate — the
//        server-side check is authoritative).
//
//   2. LEGACY customer admin realm (User.role === 'ADMIN' + anima_session):
//      - Authenticates via /login (email + password + OTP).
//      - Verified by getCurrentUser() from @/lib/auth.
//      - Preserved UNCHANGED from the pre-Stage-2 behavior so legacy admins
//        continue to work during the transition.
//
// The NEW realm is checked FIRST. If it succeeds, the legacy path is skipped.
// If the NEW realm has no session, we fall through to the legacy check —
// legacy admins who log in via /login still reach the panel.
//
// STAGE 4 will remove the legacy fallback and migrate the /api/admin/**
// routes to requireAdminSession / requirePermission. Until then, a NEW-realm
// admin (no anima_session cookie) will see the panel SHELL render, but the
// /api/admin/** data calls will 401 (the AdminLayout silently catches those
// errors — counts stay 0, views show empty states). This is the expected
// Stage 2 state; data loads correctly again after Stage 4.
// ============================================================================
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
  const section = slug?.[0] || 'dashboard'

  // ----- NEW admin realm check (Stage 2) -----
  const admin = await getCurrentAdminUser()
  if (admin) {
    if (admin.mustChangePassword) {
      redirect('/admin/change-password')
    }
    // New admin auth succeeded — render the panel.
    // NOTE: /api/admin/** routes still use legacy requireAdmin (customer
    // session) until Stage 4 migrates them. The panel shell renders; data
    // calls will 401 for new-realm admins until Stage 4.
    return (
      <SiteShell>
        <AdminLayout section={section} />
      </SiteShell>
    )
  }

  // ----- LEGACY customer admin realm check (pre-Stage-2 behavior) -----
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
