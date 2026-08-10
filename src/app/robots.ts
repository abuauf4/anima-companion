import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// /robots.txt — generated dynamically (overrides public/robots.txt).
// Allows all crawlers, points them at the sitemap, and disallows
// non-SEO routes (cart, checkout, account, admin).
export default function robots(): MetadataRoute.Robots {
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
