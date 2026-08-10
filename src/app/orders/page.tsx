import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { OrderHistoryView } from "@/views/OrderHistoryView";
import { AuthGate } from "@/components/layout/AuthGate";
import { buildMetadata } from "@/lib/seo";

// /orders — order history. Requires auth.
export const metadata: Metadata = buildMetadata({
  title: "Riwayat Pesanan",
  description: "Riwayat pesanan Anima Companion Anda.",
  path: "/orders",
  noIndex: true,
});

export default function OrdersPage() {
  return (
    <SiteShell>
      <AuthGate>
        <OrderHistoryView />
      </AuthGate>
    </SiteShell>
  );
}
