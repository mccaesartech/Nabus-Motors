import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { StatusPage } from "@/components/shared/status-page";

export const metadata: Metadata = {
  title: "Access not permitted",
  robots: { index: false, follow: false },
};

export default function ForbiddenPage() {
  return (
    <StatusPage
      code={403}
      icon={ShieldAlert}
      title="You do not have access to this area"
      description="Your account does not have permission to view this page. If you believe this is a mistake, contact your administrator."
      actions={[
        { label: "Go to homepage", href: "/" },
        { label: "Contact us", href: "/contact", variant: "outline" },
      ]}
    />
  );
}
