"use client";

import { Button } from "@/components/ui/button";
import {
  attemptRecoverFromLoadFailure,
  hasExceededReloadAttempts,
} from "@/lib/cache-recovery";
import {
  PUBLIC_UNEXPECTED_ERROR_MESSAGE,
  publicErrorReference,
} from "@/lib/errors/public-error";

export default function Error({
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
  const errorReference = publicErrorReference(error);

  if (recovering) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">Refreshing page…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        {PUBLIC_UNEXPECTED_ERROR_MESSAGE}
      </p>
      {errorReference ? (
        <p className="mt-2 max-w-md text-xs text-muted-foreground/80">
          {errorReference}
        </p>
      ) : null}
      <div className="mt-6 flex gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    </div>
  );
}
