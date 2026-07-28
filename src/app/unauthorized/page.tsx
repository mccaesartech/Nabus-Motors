import type { Metadata } from "next";
import { LogIn } from "lucide-react";
import { StatusPage } from "@/components/shared/status-page";

export const metadata: Metadata = {
  title: "Sign in required",
  robots: { index: false, follow: false },
};

export default function UnauthorizedPage() {
  return (
    <StatusPage
      code={401}
      icon={LogIn}
      title="Please sign in to continue"
      description="Your session has expired or you are not signed in. Sign in again and we will bring you back to what you were doing."
      actions={[
        { label: "Sign in", href: "/login" },
        { label: "Go to homepage", href: "/", variant: "outline" },
      ]}
    />
  );
}
