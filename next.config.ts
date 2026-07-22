import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.VERCEL_DEPLOYMENT_ID ??
  "dev";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  generateBuildId: async () => buildId,
  async rewrites() {
    return [
      // Platform UI files live under src/app/platform; public URLs use /admin/platform for PWA scope.
      { source: "/admin/platform", destination: "/platform" },
      { source: "/admin/platform/:path*", destination: "/platform/:path*" },
    ];
  },
  async redirects() {
    return [
      // Legacy platform URLs → admin-scoped paths (admin PWA scope is /admin)
      { source: "/platform", destination: "/admin/platform", permanent: false },
      { source: "/platform/:path*", destination: "/admin/platform/:path*", permanent: false },
      // Admin / platform — common mistaken URLs (login lives at /admin)
      { source: "/dashboard", destination: "/admin/platform/dashboard", permanent: false },
      { source: "/admin/login", destination: "/admin", permanent: false },
      { source: "/platform/login", destination: "/admin", permanent: false },
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
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Allow a few CDN redirects; 0 forced failures → grey placeholder flicker.
    maximumRedirects: 3,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "*.cloudinary.com" },
      { protocol: "https", hostname: "ui-avatars.com" },
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "*.imgur.com" },
      { protocol: "https", hostname: "i.pinimg.com" },
      { protocol: "https", hostname: "*.pinimg.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "images.craigslist.org" },
      { protocol: "https", hostname: "*.fbcdn.net" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
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
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/serwist/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/admin/platform/:path*",
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

export default withSerwist(nextConfig);
