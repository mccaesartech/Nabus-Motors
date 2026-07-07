import { Inter } from "next/font/google";
import { Suspense } from "react";
import { ChunkReloadHandler } from "@/components/layout/chunk-reload-handler";
import { ResourceHints } from "@/components/layout/resource-hints";
import { PublicShell } from "@/components/layout/public-shell";
import { SiteChrome } from "@/components/layout/site-chrome";
import { CurrencyProvider } from "@/context/currency-context";
import { CustomerAuthProvider } from "@/context/customer-auth-context";
import { CustomerNotificationsProvider } from "@/context/customer-notifications-context";
import { PartsCartProvider } from "@/context/parts-cart-context";
import { VehiclePreferencesSync } from "@/components/recommendations/vehicle-preferences-sync";
import { CACHE_RECOVERY_INLINE_SCRIPT } from "@/lib/cache-recovery-inline-script";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content/defaults";
import { getPublicSiteUrl } from "@/lib/site-url";
import "./globals.css";

/** ISR for public shell — busted via revalidateSiteContent() after CMS saves. */
export const revalidate = 120;

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata = {
  metadataBase: new URL(getPublicSiteUrl()),
  title: {
    default: "True Goshen Company Limited | Vehicles, Freight & Parts",
    template: "%s | True Goshen",
  },
  description:
    "True Goshen Company Limited — vehicle imports, freight forwarding, customs clearing, and genuine spare parts for Ghana and beyond.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "True Goshen Company Limited",
    images: [{ url: "/logo.png", width: 1024, height: 374, alt: "True Goshen Company Limited" }],
  },
};

function ChromeFallback({ children }: { children: React.ReactNode }) {
  return <SiteChrome content={DEFAULT_SITE_CONTENT}>{children}</SiteChrome>;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} light h-full`} suppressHydrationWarning>
      <head>
        <ResourceHints />
        <meta
          name="tg-build-id"
          content={process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}
        />
        <script
          dangerouslySetInnerHTML={{ __html: CACHE_RECOVERY_INLINE_SCRIPT }}
        />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <ChunkReloadHandler />
        <CurrencyProvider>
          <CustomerAuthProvider>
            <CustomerNotificationsProvider>
              <PartsCartProvider>
                <VehiclePreferencesSync />
                <Suspense fallback={<ChromeFallback>{children}</ChromeFallback>}>
                  <PublicShell>{children}</PublicShell>
                </Suspense>
              </PartsCartProvider>
            </CustomerNotificationsProvider>
          </CustomerAuthProvider>
        </CurrencyProvider>
      </body>
    </html>
  );
}
