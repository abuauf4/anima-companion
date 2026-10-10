import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { HomeView } from "@/views/HomeView";
import { buildMetadata, homepageJsonLd } from "@/lib/seo";

// Home page — server component with explicit brand/category targeting.
export const metadata: Metadata = buildMetadata({
  path: "/",
  title: "Anima Companion | Suplemen & Vitamin Hewan Peliharaan",
  description:
    "Anima Companion dari PT Sutan Vet Medika menyediakan suplemen & vitamin premium untuk kucing dan anjing, termasuk Felcover+, Sioren, dan Forevet. Tersedia di 400+ klinik hewan seluruh Indonesia.",
  keywords: [
    "suplemen hewan peliharaan",
    "vitamin kucing",
    "vitamin anjing",
    "suplemen kucing",
    "suplemen anjing",
  ],
});

export default function HomePage() {
  return (
    <>
      {/* Homepage-only entity ties the page to the brand and legal publisher. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homepageJsonLd()),
        }}
      />
      <SiteShell>
        <HomeView />
      </SiteShell>
    </>
  );
}
