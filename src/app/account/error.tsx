"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/shared/status-page";
import { publicErrorReference } from "@/lib/errors/public-error";

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StatusPage
      icon={AlertTriangle}
      title="Your account page could not load"
      description="Nothing has changed on your account. Try again — if the problem continues, contact us and quote the reference below."
      reference={publicErrorReference(error)}
      actions={[{ label: "Contact us", href: "/contact", variant: "outline" }]}
    >
      <Button onClick={() => reset()}>Try again</Button>
    </StatusPage>
  );
}
