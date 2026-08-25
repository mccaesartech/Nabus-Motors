import { ShieldOff } from "lucide-react";
import { StatusPage } from "@/components/shared/status-page";

export default function ForbiddenPage() {
  return (
    <StatusPage
      code={403}
      icon={ShieldOff}
      title="You do not have access"
      description="Your account does not have permission to open this page. If you believe this is a mistake, contact your administrator."
      actions={[
        { label: "Go to homepage", href: "/" },
        { label: "My account", href: "/account", variant: "outline" },
        { label: "Contact us", href: "/contact", variant: "outline" },
      ]}
    />
  );
}
