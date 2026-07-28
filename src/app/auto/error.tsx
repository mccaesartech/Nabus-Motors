"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/shared/status-page";
import { publicErrorReference } from "@/lib/errors/public-error";

export default function AutoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StatusPage
      icon={AlertTriangle}
      title="This page could not load"
      description="We could not load our vehicle listings just now. Try again, or browse the full inventory."
      reference={publicErrorReference(error)}
      actions={[{ label: "Browse inventory", href: "/auto/inventory", variant: "outline" }]}
    >
      <Button onClick={() => reset()}>Try again</Button>
    </StatusPage>
  );
}
