"use client";

import { AlertTriangle } from "lucide-react";
import { PlatformStatus } from "@/components/platform/platform-status";
import { platformPath } from "@/lib/platform/paths";
import {
  attemptRecoverFromLoadFailure,
  hasExceededReloadAttempts,
} from "@/lib/cache-recovery";
import { publicErrorReference } from "@/lib/errors/public-error";

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const recovering =
    typeof window !== "undefined" &&
    !hasExceededReloadAttempts() &&
    attemptRecoverFromLoadFailure(error);

  if (recovering) {
    return (
      <p className="p-6 text-center text-sm text-[var(--platform-text-secondary)]">Refreshing…</p>
    );
  }

  return (
    <PlatformStatus
      icon={AlertTriangle}
      title="This screen could not load"
      description="Something went wrong while loading this part of the dashboard. Your data is safe — try again, and quote the reference below if it keeps happening."
      reference={publicErrorReference(error)}
      actions={[{ label: "Back to dashboard", href: platformPath("dashboard") }]}
    >
      <button type="button" onClick={() => reset()} className="platform-btn-secondary min-h-11">
        Try again
      </button>
    </PlatformStatus>
  );
}
