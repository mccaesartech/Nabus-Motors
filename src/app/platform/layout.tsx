import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PlatformShell } from "@/components/platform/platform-shell";
import { SkipToContent } from "@/components/layout/skip-to-content";
import { AdminPwaShell } from "@/components/pwa/admin-pwa-shell";
import { getPlatformAuth } from "@/lib/admin/auth";
import { adminLoginPath } from "@/lib/admin/paths";
import { buildSessionPermissions } from "@/lib/platform/permissions";
import { ADMIN_PWA, ADMIN_PWA_THEME_COLOR } from "@/lib/pwa/constants";
import "./platform.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Allow pinch-zoom / browser maximize; do not lock orientation or maximum-scale.
  viewportFit: "cover",
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

function isInvitePath(pathname: string) {
  return /^\/admin\/platform\/invite\/[^/]+$/.test(pathname);
}

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  if (isInvitePath(pathname)) {
    return (
      <div className="platform-theme min-h-dvh overflow-x-clip">
        {children}
        <AdminPwaShell />
      </div>
    );
  }

  const auth = await getPlatformAuth();
  if (!auth) {
    redirect(adminLoginPath());
  }

  return (
    <PlatformShell
      userName={auth.name}
      userRole={auth.role}
      userEmail={auth.email}
      permissions={buildSessionPermissions(auth.role)}
      authType={auth.type}
      authUserId={auth.type === "user" ? auth.userId : undefined}
    >
      <SkipToContent />
      {children}
      <AdminPwaShell />
    </PlatformShell>
  );
}
