import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { StatusPage } from "@/components/shared/status-page";
import { getSiteSettings } from "@/lib/platform/site-settings-server";
import { DEFAULT_MAINTENANCE_MESSAGE } from "@/lib/maintenance/rules";
import { SITE_NAME, WHATSAPP_NUMBER, whatsappUrl } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Scheduled maintenance | ${SITE_NAME}`,
  description: "Nabus Motors is briefly offline for scheduled maintenance.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const settings = await getSiteSettings();
  const message =
    (settings.maintenance_message || "").trim() || DEFAULT_MAINTENANCE_MESSAGE;
  const inMaintenance = settings.maintenanceMode;
  const waNumber = (settings.whatsapp_number || "").trim() || WHATSAPP_NUMBER;
  const waHref = whatsappUrl(
    "Hello Nabus Motors — I need help while the site is under maintenance.",
    waNumber
  );

  return (
    <StatusPage
      icon={Wrench}
      title={`${SITE_NAME} is under maintenance`}
      description={message}
      actions={
        inMaintenance
          ? [{ label: "Message us on WhatsApp", href: waHref, variant: "default" }]
          : [
              { label: "Back to home", href: "/" },
              { label: "Contact us", href: "/contact", variant: "outline" },
            ]
      }
    />
  );
}
