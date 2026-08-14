import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { HashRedirect } from "@/components/layout/HashRedirect";
import {
  SITE_URL,
  BRAND,
  ALLOW_INDEXING,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/seo";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Default site-wide metadata — individual pages override via `buildMetadata()`.
// Note: `title.template` is intentionally NOT set, because `buildMetadata()`
// returns the absolute (fully-formed) title for each page. This avoids the
// Next.js "template wraps absolute title twice" gotcha.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
  applicationName: BRAND.name,
  authors: [{ name: BRAND.legalName }],
  creator: BRAND.legalName,
  publisher: BRAND.legalName,
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
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
    shortcut: "/logo.svg",
  },
  openGraph: {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.description,
    siteName: BRAND.name,
    url: SITE_URL,
    type: "website",
    locale: "id_ID",
    images: [
      {
        url: BRAND.ogImage,
        width: 1200,
        height: 630,
        alt: `${BRAND.name} — ${BRAND.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: "Suplemen & vitamin hewan peliharaan premium untuk kucing & anjing.",
    images: [BRAND.ogImage],
  },
  robots: ALLOW_INDEXING
    ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-image-preview': 'large',
          'max-snippet': -1,
          'max-video-preview': -1,
        },
      }
    : {
        // Non-production deployment (staging/preview/local): noindex,nofollow
        // sitewide. Canonical URLs still point to https://animacompanion.id
        // via alternates.canonical above, so Google will consolidate signals
        // to the production URL without indexing the staging clone.
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
        },
      },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Preload critical assets for instant first paint */}
        <link rel="preload" href="/anima-logo.svg" as="image" type="image/svg+xml" />
        <link
          rel="preload"
          as="image"
          href="/_next/image?url=%2Fhero-pets.webp&w=640&q=75"
        />
        {/* JSON-LD structured data — Organization + WebSite sitewide */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd()),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteJsonLd()),
          }}
        />
      </head>
      <body
        className={`${jakarta.variable} font-sans antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        {children}
        <Toaster />
        {/* Mount once at root so old hash URLs redirect to their new canonical path. */}
        <HashRedirect />
      </body>
    </html>
  );
}
