import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { HomeView } from "@/views/HomeView";
import { buildMetadata } from "@/lib/seo";

// Home page — server component with full SEO metadata.
// Static: prerendered at build time. HomeView (client) hydrates with cart/auth state.
export const metadata: Metadata = buildMetadata({
  path: "/",
  description:
    "Anima Companion (PT Sutan Vet Medika) — suplemen & vitamin hewan peliharaan premium. Produk Felcover+, Sioren, dan Forevet. Tersedia di 515+ klinik hewan seluruh Indonesia.",
});

export default function HomePage() {
  return (
    <SiteShell>
      <HomeView />
    </SiteShell>
  );
}
