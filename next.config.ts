import type { NextConfig } from "next";

const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.VERCEL_DEPLOYMENT_ID ??
  "dev";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  generateBuildId: async () => buildId,
  async redirects() {
    return [
      { source: "/freight", destination: "/freight-forwarding", permanent: true },
      { source: "/freight/:path*", destination: "/freight-forwarding/:path*", permanent: true },
      { source: "/parts", destination: "/auto/spare-parts", permanent: true },
      { source: "/parts/:path*", destination: "/auto/spare-parts/:path*", permanent: true },
      { source: "/spare-parts", destination: "/auto/spare-parts", permanent: true },
      { source: "/spare-parts/:path*", destination: "/auto/spare-parts/:path*", permanent: true },
      { source: "/inventory", destination: "/auto/inventory", permanent: true },
      { source: "/inventory/:path*", destination: "/auto/inventory/:path*", permanent: true },
      { source: "/buy", destination: "/auto/buy", permanent: true },
      { source: "/sell", destination: "/auto/sell", permanent: true },
      { source: "/financing", destination: "/auto/financing", permanent: true },
      { source: "/garage", destination: "/auto/garage", permanent: true },
      { source: "/appointments", destination: "/account?section=visit", permanent: false },
      { source: "/auto/pre-order", destination: "/auto/inventory?status=pre_order", permanent: false },
    ];
  },
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "ui-avatars.com" },
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "*.imgur.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "**" },
    ],
  },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/videos/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/platform/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
