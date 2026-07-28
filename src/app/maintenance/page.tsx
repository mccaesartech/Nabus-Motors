import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { StatusPage } from "@/components/shared/status-page";

export const metadata: Metadata = {
  title: "Scheduled maintenance",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <StatusPage
      code={503}
      icon={Wrench}
      title="We are carrying out scheduled maintenance"
      description="True Goshen is briefly offline while we make an update. Nothing you saved has been lost. Please check back shortly — or reach us on WhatsApp if it is urgent."
      actions={[
        { label: "Try again", href: "/" },
        { label: "Contact us", href: "/contact", variant: "outline" },
      ]}
    />
  );
}
