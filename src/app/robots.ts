import type { MetadataRoute } from "next";
import { SITE_URL, ALLOW_INDEXING } from "@/lib/seo";

// /robots.txt — generated dynamically (overrides public/robots.txt).
//
// Two modes (Phase 1.1):
//
// - Production (NEXT_PUBLIC_ALLOW_INDEXING === "true"):
//     Allow all crawlers on `/`, disallow non-SEO routes (cart/checkout/account/
//     admin/api), point at sitemap, declare host.
//
// - Non-production (staging / preview / local / unset):
//     Disallow ALL crawling (`Disallow: /`) and DO NOT advertise a sitemap.
//     This is independent of the canonical URL — even though canonical stays
//     https://animacompanion.id on staging, we must not let crawlers fetch the
//     staging deployment at all. Combined with the sitewide noindex meta tag
//     emitted by layout.tsx, this gives a defence-in-depth guarantee that the
//     staging deployment can never be indexed.
export default function robots(): MetadataRoute.Robots {
  if (!ALLOW_INDEXING) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
      // Intentionally NO sitemap entry — staging must not advertise a
      // sitemap, because the sitemap would still contain production
      // canonical URLs and confuse crawlers about which deployment owns them.
    }
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/cart",
          "/checkout",
          "/login",
          "/register",
          "/forgot-password",
          "/verify-email",
          "/reset-password",
          "/profile",
          "/orders",
          "/wishlist",
          "/admin",
          "/api",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
