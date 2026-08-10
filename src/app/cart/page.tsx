import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { CartView } from "@/views/CartView";
import { buildMetadata } from "@/lib/seo";

// /cart — shopping cart. Client-state heavy (zustand), noindex to avoid
// search engines indexing ephemeral cart state.
export const metadata: Metadata = buildMetadata({
  title: "Keranjang",
  description: "Keranjang belanja Anima Companion Anda.",
  path: "/cart",
  noIndex: true,
});

export default function CartPage() {
  return (
    <SiteShell>
      <CartView />
    </SiteShell>
  );
}
