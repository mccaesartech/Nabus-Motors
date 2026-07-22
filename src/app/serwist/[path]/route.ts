import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.NEXT_PUBLIC_BUILD_ID ||
  crypto.randomUUID();

/** Only shell assets belong in precache — runtime rules handle everything else. */
function isCriticalPrecacheAsset(url: string): boolean {
  if (url === "/offline" || url.startsWith("/offline?")) return true;
  if (url.startsWith("/icons/")) return true;
  if (url.endsWith("/manifest.webmanifest") || url.endsWith("manifest.webmanifest")) {
    return true;
  }
  if (
    url === "/favicon.ico" ||
    url === "/favicon-16.png" ||
    url === "/favicon-32.png" ||
    url === "/apple-touch-icon.png"
  ) {
    return true;
  }
  return false;
}

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
    maximumFileSizeToCacheInBytes: 256 * 1024,
    globIgnores: [
      "**/node_modules/**",
      "**/videos/**",
      "**/vehicles/cars/**",
      "**/platform/**",
      "**/admin/**",
      "**/_next/**",
      "**/*.map",
      "**/images/**",
      "**/*.html",
      "**/api/**",
    ],
    manifestTransforms: [
      async (manifest) => ({
        manifest: manifest.filter((entry) => isCriticalPrecacheAsset(entry.url)),
      }),
    ],
    additionalPrecacheEntries: [
      { url: "/offline", revision },
      { url: "/icons/icon-192x192.png", revision },
      { url: "/icons/icon-512x512.png", revision },
      { url: "/icons/icon-192x192-maskable.png", revision },
      { url: "/icons/icon-512x512-maskable.png", revision },
      { url: "/manifest.webmanifest", revision },
      { url: "/admin/manifest.webmanifest", revision },
    ],
  });
