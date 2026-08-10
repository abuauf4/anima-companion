import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/SiteShell";
import { buildMetadata } from "@/lib/seo";
import { whatsappAdminUrl } from "@/lib/config";
import { Building2, MapPin, Mail, Phone, Clock, Shield, Heart, PawPrint, MessageCircle, ShoppingBag } from "lucide-react";

// /tentang — About page (new in Phase 1, required for SEO).
// Server component. Uses brand copy already present in Footer & HomeView —
// no new marketing copy invented, no UI redesign; just consolidates existing
// brand identity information onto its own URL so it can be linked and indexed.
export const metadata: Metadata = buildMetadata({
  title: "Tentang Kami",
  description:
    "Anima Companion — PT Sutan Vet Medika. Brand suplemen & vitamin hewan peliharaan premium yang dirancang bersama dokter hewan, tersedia di 515+ klinik seluruh Indonesia. Misi: Elevating Animal Health.",
  path: "/tentang",
  keywords: [
    "tentang anima companion",
    "PT Sutan Vet Medika",
    "brand suplemen hewan",
    "suplemen dokter hewan",
    "515 klinik hewan Indonesia",
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
            Diformulasikan bersama dokter hewan, tersedia di 515+ klinik seluruh Indonesia.
          </p>
        </section>

        {/* Trust badges row (mirrors Footer trust badges) */}
        <section className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: Shield, title: "BPOM Terdaftar", desc: "Produk resmi & aman" },
            { icon: Heart, title: "100% Asli", desc: "Dijamin original" },
            { icon: PawPrint, title: "515+ Klinik", desc: "Distributor resmi" },
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

        {/* Brand story */}
        <section className="mt-16 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Misi Kami</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Anima Companion hadir untuk meningkatkan kualitas hidup hewan peliharaan
              melalui suplemen &amp; vitamin yang dirancang bersama dokter hewan.
              Setiap produk diformulasikan dengan bahan aktif pilihan dan terdaftar
              resmi di BPOM, sehingga aman digunakan untuk kucing &amp; anjing
              peliharaan Anda.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Kami percaya pawrent hebat = anabul sehat. Itulah mengapa setiap
              produk kami didistribusikan melalui jaringan 515+ klinik hewan
              terpercaya di seluruh Indonesia — agar konsultasi vet dan akses
              suplemen premium selalu dalam jangkauan.
            </p>
            <p className="mt-3 text-sm font-semibold text-secondary">
              #PawrentHebatAnabulSehat
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Identitas Perusahaan</h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
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
                  Bogor, Jawa Barat, Indonesia
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 text-primary" />
                <span>
                  <span className="font-semibold text-foreground">Email:</span>{" "}
                  hello@animacompanion.id
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 text-primary" />
                <span>
                  <span className="font-semibold text-foreground">WhatsApp:</span>{" "}
                  +62 812-3456-7890
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

            <div className="flex flex-wrap gap-2 pt-2">
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
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
