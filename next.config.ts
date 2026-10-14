import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Trigger Next.js dev server reload
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/app',
        permanent: false,
      },
      {
        source: '/dashboard/:path*',
        destination: '/app/:path*',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
