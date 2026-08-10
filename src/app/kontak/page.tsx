import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { ContactView } from "@/views/ContactView";
import { buildMetadata } from "@/lib/seo";

// /kontak — contact page (FAQ + WhatsApp + company contact info).
export const metadata: Metadata = buildMetadata({
  title: "Konsultasi & Kontak",
  description:
    "Hubungi Anima Companion untuk konsultasi gratis bersama dokter hewan. Tersedia via WhatsApp, email, dan Instagram. Senin–Sabtu, 09.00–18.00 WIB.",
  path: "/kontak",
  keywords: [
    "kontak anima companion",
    "konsultasi dokter hewan",
    "konsultasi gratis hewan",
    "WhatsApp anima companion",
    "FAQ suplemen hewan",
  ],
});

export default function KontakPage() {
  return (
    <SiteShell>
      <ContactView />
    </SiteShell>
  );
}
