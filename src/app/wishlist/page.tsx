import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { WishlistView } from "@/views/WishlistView";
import { buildMetadata } from "@/lib/seo";

// /wishlist — wishlist. Client-state only (persisted to zustand), no auth required.
export const metadata: Metadata = buildMetadata({
  title: "Wishlist",
  description: "Wishlist Anima Companion Anda.",
  path: "/wishlist",
  noIndex: true,
});

export default function WishlistPage() {
  return (
    <SiteShell>
      <WishlistView />
    </SiteShell>
  );
}
