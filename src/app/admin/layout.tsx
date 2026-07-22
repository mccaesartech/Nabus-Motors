import type { Metadata, Viewport } from "next";
import { AdminPwaShell } from "@/components/pwa/admin-pwa-shell";
import { ADMIN_PWA, ADMIN_PWA_THEME_COLOR } from "@/lib/pwa/constants";
import "../platform/platform.css";

export const viewport: Viewport = {
  themeColor: ADMIN_PWA_THEME_COLOR,
};

export const metadata: Metadata = {
  applicationName: ADMIN_PWA.name,
  title: {
    default: ADMIN_PWA.name,
    template: `%s | ${ADMIN_PWA.shortName}`,
  },
  description: ADMIN_PWA.description,
  manifest: ADMIN_PWA.manifestPath,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: ADMIN_PWA.shortName,
  },
  icons: {
    icon: [
      { url: "/icons/admin/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/admin/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/admin/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "theme-color": ADMIN_PWA_THEME_COLOR,
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="platform-theme min-h-dvh overflow-x-clip">
      {children}
      <AdminPwaShell />
    </div>
  );
}
