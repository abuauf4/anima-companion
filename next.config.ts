import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    qualities: [70, 75, 80, 90],
    dangerouslyAllowSVG: true,
    // Image strategy:
    //   - Static local product images live in /public/products/<slug>/*.webp
    //     (Phase 2 — kept as-is, NOT migrated).
    //   - NEW product images uploaded from the Admin UI are pushed to Cloudinary
    //     via signed uploads (see src/lib/cloudinary.ts). The returned
    //     `https://res.cloudinary.com/...` URLs are stored in ProductImage.url
    //     alongside the existing local paths — the two are fully interchangeable.
    //   - Only `res.cloudinary.com` is whitelisted for next/image. We do NOT
    //     re-open the wildcard `**` pattern — only Cloudinary delivery URLs
    //     produced by the admin uploader pass through.
    //   - placehold.co URLs (still used by some BANNER seed entries) are
    //     intercepted by src/lib/placeholder.ts BEFORE reaching next/image,
    //     so they do not need a remotePattern entry here.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  // Redirect /favicon.ico to /logo.svg — browsers auto-request favicon.ico
  // regardless of <link rel="icon"> metadata. This prevents 404.
  async rewrites() {
    return [
      {
        source: '/favicon.ico',
        destination: '/logo.svg',
      },
    ]
  },
  // Backwards-compat redirects: old hash-router paths (now real URLs) → new canonical paths.
  // /shop          → /produk       (shop listing)
  // /product/:slug → /produk/:slug (product detail)
  // Permanent (308) so search engines & bookmarks update.
  async redirects() {
    return [
      {
        source: '/shop',
        destination: '/produk',
        permanent: true,
      },
      {
        source: '/product/:slug*',
        destination: '/produk/:slug*',
        permanent: true,
      },
    ]
  },
  // Tree-shake large barrel-export packages — only bundle used exports
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'recharts',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-select',
      '@radix-ui/react-popover',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-accordion',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-switch',
      '@radix-ui/react-progress',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-avatar',
      '@radix-ui/react-label',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-sheet',
    ],
  },
};

export default nextConfig;
