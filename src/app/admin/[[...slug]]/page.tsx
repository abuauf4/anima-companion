import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminGate } from "@/components/layout/AuthGate";
import { buildMetadata } from "@/lib/seo";

// /admin/* — admin dashboard. Catch-all route.
// AdminGate enforces ADMIN role; AdminLayout reads the current path
// to decide which admin section to render.

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

  return (
    <SiteShell>
      <AdminGate>
        <AdminLayout section={section} />
      </AdminGate>
    </SiteShell>
  )
}
