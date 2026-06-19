import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Anima Companion — Elevating Animal Health",
  description:
    "Anima Companion (PT Sutan Vet Medika) — suplemen & vitamin hewan peliharaan rekomendasi dokter hewan. Produk Felcover+, Sioren, dan Forevet. Tersedia di 515+ klinik hewan seluruh Indonesia.",
  keywords: [
    "anima companion",
    "felcover",
    "felcover plus",
    "sioren",
    "forevet",
    "suplemen kucing",
    "suplemen anjing",
    "imun booster hewan",
    "vitamin hewan",
    "kesehatan hewan peliharaan",
    "PT Sutan Vet Medika",
    "PawrentHebatAnabulSehat",
  ],
  authors: [{ name: "PT Sutan Vet Medika — Anima Companion" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Anima Companion — Elevating Animal Health",
    description:
      "Suplemen & vitamin hewan peliharaan rekomendasi dokter hewan. Produk Felcover+, Sioren, dan Forevet. Tersedia di 515+ klinik hewan seluruh Indonesia.",
    siteName: "Anima Companion",
    type: "website",
    locale: "id_ID",
  },
  twitter: {
    card: "summary_large_image",
    title: "Anima Companion — Elevating Animal Health",
    description: "Suplemen rekomendasi dokter hewan untuk kucing & anjing.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
