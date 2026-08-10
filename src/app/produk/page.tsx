import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { ShopView } from "@/views/ShopView";
import { buildMetadata } from "@/lib/seo";

// /produk — shop listing with filters. Server component for SEO.
// ShopView (client) handles filter state via URLSearchParams.
export const metadata: Metadata = buildMetadata({
  title: "Produk",
  description:
    "Belanja suplemen & vitamin hewan peliharaan premium dari Anima Companion. Filter berdasarkan kategori, manfaat, jenis hewan, dan brand. Felcover+, Sioren, Forevet — tersedia di 515+ klinik seluruh Indonesia.",
  path: "/produk",
  keywords: [
    "beli suplemen kucing",
    "beli suplemen anjing",
    "belanja vitamin hewan",
    "Felcover+",
    "Sioren",
    "Forevet",
    "suplemen imun",
    "suplemen bulu",
    "suplemen pencernaan",
  ],
});

export default function ProdukPage() {
  return (
    <SiteShell>
      <ShopView />
    </SiteShell>
  );
}
