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
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: '**' },
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
