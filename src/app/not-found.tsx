import { SearchX } from "lucide-react";
import { StatusPage } from "@/components/shared/status-page";

export default function NotFound() {
  return (
    <StatusPage
      code={404}
      icon={SearchX}
      title="We could not find that page"
      description="The link may be out of date, or the vehicle or page may have been removed. Try browsing our current stock instead."
      actions={[
        { label: "Go to homepage", href: "/" },
        { label: "Browse inventory", href: "/auto/inventory", variant: "outline" },
        { label: "Contact us", href: "/contact", variant: "outline" },
      ]}
    />
  );
}
