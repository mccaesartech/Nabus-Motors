import { ServerCrash } from "lucide-react";
import { StatusPage } from "@/components/shared/status-page";

export default function ServerErrorPage() {
  return (
    <StatusPage
      code={500}
      icon={ServerCrash}
      title="Something went wrong on our side"
      description="We hit an unexpected error. Please try again in a moment. If it keeps happening, contact us with the time it occurred."
      actions={[
        { label: "Go to homepage", href: "/" },
        { label: "Contact us", href: "/contact", variant: "outline" },
      ]}
    />
  );
}
