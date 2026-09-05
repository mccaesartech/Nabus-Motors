import { Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { DeferredChunkReloadHandler } from "@/components/layout/deferred-chunk-reload-handler";
import { ResourceHints } from "@/components/layout/resource-hints";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { PublicShell } from "@/components/layout/public-shell";
import { SiteChrome } from "@/components/layout/site-chrome";
import { DeferredPwaShell } from "@/components/pwa/deferred-pwa-shell";
import { DeferredVehiclePreferencesSync } from "@/components/recommendations/deferred-vehicle-preferences-sync";
import { CurrencyProvider } from "@/context/currency-context";
import { CustomerAuthProvider } from "@/context/customer-auth-context";
import { CustomerNotificationsProvider } from "@/context/customer-notifications-context";
import { PartsCartProvider } from "@/context/parts-cart-context";
import { buildCacheRecoveryInlineScript } from "@/lib/cache-recovery-inline-script";
import { CUSTOMER_PWA, PWA_BACKGROUND_COLOR, PWA_THEME_COLOR } from "@/lib/pwa/constants";
import { getSiteSettings } from "@/lib/platform/site-settings-server";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content/defaults";
import { getPublicSiteUrl, isCustomDomainLive } from "@/lib/site-url";
import "./globals.css";

const CACHE_RECOVERY_INLINE_SCRIPT = buildCacheRecoveryInlineScript(
  getPublicSiteUrl(),
  isCustomDomainLive()
);

/**
 * Root layout reads `x-nonce` for CSP. That opts the tree into dynamic rendering
 * (required for per-request script nonces — see docs/CSP.md).
 */

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: PWA_THEME_COLOR,
};

export const metadata: Metadata = {
  metadataBase: new URL(getPublicSiteUrl()),
  applicationName: CUSTOMER_PWA.name,
  title: {
    default: "Nabus Motors | Drive Your Dream Car",
    template: "%s | Nabus Motors",
  },
  description: CUSTOMER_PWA.description,
  manifest: CUSTOMER_PWA.manifestPath,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: CUSTOMER_PWA.shortName,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    siteName: "Nabus Motors and Trading",
    images: [{ url: "/logo.png", width: 1024, height: 374, alt: "Nabus Motors and Trading" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "msapplication-TileColor": PWA_THEME_COLOR,
    "msapplication-config": "none",
    "theme-color": PWA_THEME_COLOR,
    "background-color": PWA_BACKGROUND_COLOR,
  },
};

function ChromeFallback({ children }: { children: React.ReactNode }) {
  return <SiteChrome content={DEFAULT_SITE_CONTENT}>{children}</SiteChrome>;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const settings = await getSiteSettings();

  return (
    <html lang="en" className={`${instrumentSans.variable} ${ibmPlexMono.variable} light h-full`} suppressHydrationWarning>
      <head>
        <ResourceHints />
        <meta
          name="tg-build-id"
          content={process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}
        />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: CACHE_RECOVERY_INLINE_SCRIPT }}
        />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <SkipToContent />
        <DeferredChunkReloadHandler />
        <CurrencyProvider settingsDefaultCurrency={settings.default_currency_display}>
          <CustomerAuthProvider>
            <CustomerNotificationsProvider>
              <PartsCartProvider>
                <DeferredVehiclePreferencesSync />
                <Suspense fallback={<ChromeFallback>{children}</ChromeFallback>}>
                  <PublicShell>{children}</PublicShell>
                </Suspense>
              </PartsCartProvider>
            </CustomerNotificationsProvider>
          </CustomerAuthProvider>
        </CurrencyProvider>
        <DeferredPwaShell />
      </body>
    </html>
  );
}
