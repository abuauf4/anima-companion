import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Anima Companion — Healthy Pets, Happy Companions",
  description:
    "Anima Companion adalah platform e-commerce vitamin, suplemen, dan kebutuhan kesehatan hewan peliharaan. Belanja mudah, cepat, dan terpercaya untuk kucing, anjing, burung, ikan, dan hewan kecil lainnya.",
  keywords: [
    "vitamin hewan",
    "suplemen kucing",
    "suplemen anjing",
    "kesehatan hewan peliharaan",
    "pet health",
    "anima companion",
    "obat kucing",
    "perawatan hewan",
  ],
  authors: [{ name: "Anima Companion" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Anima Companion — Healthy Pets, Happy Companions",
    description:
      "Vitamin, suplemen, dan kebutuhan kesehatan hewan peliharaan. Belanja mudah via WhatsApp.",
    siteName: "Anima Companion",
    type: "website",
    locale: "id_ID",
  },
  twitter: {
    card: "summary_large_image",
    title: "Anima Companion",
    description: "Vitamin & suplemen kesehatan hewan peliharaan.",
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
