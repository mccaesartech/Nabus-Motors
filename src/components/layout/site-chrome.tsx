"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { FoldHeader, FoldHeaderStatic } from "@/components/fold/fold-header";
import { FoldFooter } from "@/components/fold/fold-footer";
import { CustomerBackBar } from "@/components/layout/customer-back-bar";
import { MaintenanceBanner } from "@/components/layout/maintenance-banner";
import { InstallCustomerAppBanner } from "@/components/pwa/install-customer-app-banner";
import { PwaInstallToastHost } from "@/components/pwa/pwa-install-toast-host";
import { PlatformPublicHistoryBounce } from "@/components/layout/platform-public-history-bounce";
import { isAdminAppPath } from "@/lib/pwa/routes";
import type { OperationalSettings, SiteSettings } from "@/lib/platform/site-settings";
import { toOperationalSettings } from "@/lib/platform/site-settings";
import { DEFAULT_SITE_SETTINGS } from "@/lib/platform/modules";
import { isAutoDivisionPath, ROUTES } from "@/lib/routes";
import type { SiteContent } from "@/lib/site-content/defaults";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content/defaults";

const WhatsAppFloat = dynamic(
  () =>
    import("@/components/layout/whatsapp-float").then((m) => ({
      default: m.WhatsAppFloat,
    })),
  { ssr: false }
);

const CompareFloatingBar = dynamic(
  () =>
    import("@/components/compare/compare-floating-bar").then((m) => ({
      default: m.CompareFloatingBar,
    })),
  { ssr: false }
);

type SiteChromeProps = {
  children: React.ReactNode;
  content?: SiteContent;
  operational?: OperationalSettings;
};

export function SiteChrome({
  children,
  content = DEFAULT_SITE_CONTENT,
  operational = toOperationalSettings(DEFAULT_SITE_SETTINGS as SiteSettings),
}: SiteChromeProps) {
  const pathname = usePathname() ?? "";
  const isAdmin = isAdminAppPath(pathname);
  const useAutoChrome = isAutoDivisionPath(pathname);
  const isAutoHome = pathname === "/" || pathname === ROUTES.auto.home || pathname === ROUTES.corporate.home;

  if (isAdmin) {
    return (
      <>
        <PlatformPublicHistoryBounce />
        {children}
      </>
    );
  }

  return (
    <>
      <PlatformPublicHistoryBounce />
      {operational.maintenanceMode && pathname !== "/maintenance" ? (
        <MaintenanceBanner message={operational.maintenance_message} />
      ) : null}
      <Suspense fallback={<FoldHeaderStatic content={content} transparent={isAutoHome} />}>
        <FoldHeader content={content} transparent={isAutoHome} />
      </Suspense>
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "min-w-0 flex-1 overflow-x-hidden pb-[var(--compare-bar-height,0px)] outline-none",
          isAutoHome ? "pt-0" : "pt-[var(--shell-top-offset)]"
        )}
      >
        <CustomerBackBar />
        {children}
        <InstallCustomerAppBanner />
      </main>
      <FoldFooter content={content} brand="auto" />
      <WhatsAppFloat whatsappNumber={operational.whatsapp_number || content.global.whatsappNumber} />
      <PwaInstallToastHost />
      {useAutoChrome ? <CompareFloatingBar /> : null}
    </>
  );
}
