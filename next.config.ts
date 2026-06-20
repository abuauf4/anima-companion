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
};

export default nextConfig;
