import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { CheckoutView } from "@/views/CheckoutView";
import { buildMetadata } from "@/lib/seo";

// /checkout — checkout flow. Auth/cart required at runtime; noindex.
export const metadata: Metadata = buildMetadata({
  title: "Checkout",
  description: "Selesaikan pesanan Anima Companion Anda.",
  path: "/checkout",
  noIndex: true,
});

export default function CheckoutPage() {
  return (
    <SiteShell>
      <CheckoutView />
    </SiteShell>
  );
}
