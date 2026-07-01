"use client";

import { Suspense, useMemo } from "react";
import { usePathname } from "next/navigation";
import { Header, HeaderStatic } from "@/components/layout/header";
import { CorporateHeader } from "@/components/layout/corporate-header";
import { DivisionContextBar } from "@/components/layout/division-context-bar";
import { FreightSubNav } from "@/components/layout/freight-sub-nav";
import { Footer } from "@/components/layout/footer";
import { MaintenanceBanner } from "@/components/layout/maintenance-banner";
import { WhatsAppFloat } from "@/components/layout/whatsapp-float";
import { ADMIN_PATH } from "@/lib/admin/paths";
import type { OperationalSettings, SiteSettings } from "@/lib/platform/site-settings";
import { toOperationalSettings } from "@/lib/platform/site-settings";
import { DEFAULT_SITE_SETTINGS } from "@/lib/platform/modules";
import { isAutoDivisionPath, isFreightDivisionPath, ROUTES } from "@/lib/routes";
import type { SiteContent } from "@/lib/site-content/defaults";
import { DEFAULT_SITE_CONTENT } from "@/lib/site-content/defaults";

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
  const isAdmin =
    pathname.startsWith(`/${ADMIN_PATH}`) || pathname.startsWith("/platform");

  const displayContent = useMemo(() => {
    if (operational.featureShowSparePartsNav) return content;
    return {
      ...content,
      header: {
        ...content.header,
        navLinks: content.header.navLinks.filter(
          (link) => link.href !== ROUTES.auto.spareParts
        ),
      },
    };
  }, [content, operational.featureShowSparePartsNav]);

  if (isAdmin) {
    return <>{children}</>;
  }

  const useAutoHeader = isAutoDivisionPath(pathname);
  const useFreightSubNav = isFreightDivisionPath(pathname);

  return (
    <>
      {operational.maintenanceMode ? (
        <MaintenanceBanner message={operational.maintenance_message} />
      ) : null}
      {useAutoHeader ? (
        <Suspense fallback={<HeaderStatic content={displayContent} />}>
          <Header content={displayContent} />
        </Suspense>
      ) : (
        <CorporateHeader
          content={displayContent}
          showFreightNav={operational.featureShowFreightNav}
        />
      )}
      <main className="min-w-0 flex-1 overflow-x-hidden pt-[var(--header-height)]">
        {useFreightSubNav ? <FreightSubNav /> : <DivisionContextBar />}
        {children}
      </main>
      <Footer
        content={displayContent}
        showInventory={useAutoHeader}
        brand={useAutoHeader ? "auto" : "corporate"}
      />
      <WhatsAppFloat whatsappNumber={operational.whatsapp_number || content.global.whatsappNumber} />
    </>
  );
}
