import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { buildMetadata } from "@/lib/seo";
import { whatsappAdminUrl, whatsappDisplayNumber, whatsappTelUrl } from "@/lib/config";
import { Building2, MapPin, Mail, Phone, Clock, Shield, Heart, PawPrint, MessageCircle, ShoppingBag } from "lucide-react";

// /tentang — About page.
//
// IMPORTANT (Phase 1.1):
// - This page is `noindex` and excluded from sitemap.ts. The route returns 200
//   so internal links do not break, but it must not appear in Google's index.
// - Marketing prose invented during the Phase 1 refactor has been REMOVED.
//   Only fact-style contact/identity information already present elsewhere in
//   the codebase (Footer / SITE_CONFIG) remains.
// - The remaining contact/identity values (PT Sutan Vet Medika, Gedung STP - IPB
//   address, sutanvetmedika@gmail.com, 0822 1084 6408, Senin–Sabtu 09.00–18.00 WIB,
//   400+ klinik, BPOM Terdaftar, #PawrentHebatAnabulSehat) are NOT verified —
//   they are inherited from existing repo content pending a separate content
//   audit. Do not treat them as authoritative until that audit is complete.
// - No new marketing copy has been added. When official Anima "Tentang Kami"
//   content becomes available, re-enable indexing by removing `noIndex: true`
//   below and re-adding the `/tentang` entry to src/app/sitemap.ts.
export const metadata: Metadata = buildMetadata({
  title: "Tentang Kami",
  description:
    "Anima Companion — PT Sutan Vet Medika. Brand suplemen & vitamin hewan peliharaan. Tersedia di 400+ klinik seluruh Indonesia. Misi: Elevating Animal Health.",
  path: "/tentang",
  // Always noindex regardless of deployment env, until official Anima content
  // is provided. buildMetadata() also force-noindexes on staging, but this
  // explicit flag keeps /tentang out of production indexing too.
  noIndex: true,
  keywords: [
    "tentang anima companion",
    "PT Sutan Vet Medika",
    "brand suplemen hewan",
    "suplemen hewan peliharaan",
    "400 klinik hewan Indonesia",
  ],
});

export default function TentangPage() {
  return (
    <SiteShell>
      <div className="container-page py-10 md:py-16">
        {/* Hero — brand identity */}
        <section className="mx-auto max-w-3xl text-center">
          <div className="mb-6 flex justify-center">
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-border/30">
              <img
                src="/anima-logo.svg"
                alt="Anima Companion logo"
                width={80}
                height={80}
                className="h-full w-full"
                loading="eager"
              />
            </span>
          </div>
          <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Tentang <span className="gradient-brand-text">Anima Companion</span>
          </h1>
          <p className="mt-4 text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
            <span className="font-semibold text-foreground">Elevating Animal Health</span> —
            Suplemen &amp; vitamin hewan peliharaan premium dari PT Sutan Vet Medika.
          </p>
        </section>

        {/* Trust badges row (mirrors Footer trust badges) */}
        <section className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: Shield, title: "BPOM Terdaftar", desc: "Produk resmi & aman" },
            { icon: Heart, title: "100% Asli", desc: "Dijamin original" },
            { icon: PawPrint, title: "400+ Klinik", desc: "Distributor resmi" },
            { icon: MessageCircle, title: "Fast Response", desc: "via WhatsApp" },
          ].map((b) => {
            const Icon = b.icon
            return (
              <div
                key={b.title}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center"
              >
                <Icon className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{b.title}</p>
                  <p className="text-xs text-muted-foreground">{b.desc}</p>
                </div>
              </div>
            )
          })}
        </section>

        {/* Company identity — fact-style, no marketing prose */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold">Identitas Perusahaan</h2>
          <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Building2 className="mt-0.5 h-4 w-4 text-primary" />
              <span>
                <span className="font-semibold text-foreground">Legal Entity:</span>{" "}
                PT Sutan Vet Medika
              </span>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-primary" />
              <span>
                <span className="font-semibold text-foreground">Lokasi:</span>{" "}
                Gedung STP - IPB lt 1, Bogor, Jawa Barat
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 text-primary" />
              <span>
                <span className="font-semibold text-foreground">Email:</span>{" "}
                sutanvetmedika@gmail.com
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 text-primary" />
              <span>
                <span className="font-semibold text-foreground">WhatsApp:</span>{" "}
                <a
                  href={whatsappTelUrl()}
                  className="hover:text-primary transition-colors"
                  aria-label="Telepon Anima Companion"
                >
                  {whatsappDisplayNumber()}
                </a>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 text-primary" />
              <span>
                <span className="font-semibold text-foreground">Jam Operasional:</span>{" "}
                Senin–Sabtu, 09.00–18.00 WIB
              </span>
            </li>
          </ul>

          <div className="mt-6 flex flex-wrap gap-2">
            <a
              href={whatsappAdminUrl("Halo Anima Companion! Saya ingin bertanya tentang produk 🐾")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Chat WhatsApp
            </a>
            <a
              href="/produk"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <ShoppingBag className="h-3.5 w-3.5" /> Lihat Produk
            </a>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
