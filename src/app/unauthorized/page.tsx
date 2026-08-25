import { Lock } from "lucide-react";
import { StatusPage } from "@/components/shared/status-page";

export default function UnauthorizedPage() {
  return (
    <StatusPage
      code={401}
      icon={Lock}
      title="Sign in required"
      description="You need to sign in to view this page. If you were already signed in, your session may have expired."
      actions={[
        { label: "Sign in", href: "/login" },
        { label: "Create account", href: "/register", variant: "outline" },
        { label: "Go to homepage", href: "/", variant: "outline" },
      ]}
    />
  );
}
