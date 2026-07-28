"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import type { VehicleImageMatchIssue } from "@/lib/ai/vehicle-image-match-types";

type VehicleImageMismatchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: string;
  issues: VehicleImageMatchIssue[];
  /** Soft gate (uncertain / AI unavailable) — allow explicit photo confirmation. */
  allowManualConfirm?: boolean;
  onRejectImages: () => void;
  onCorrect: () => void;
  onManualConfirm?: () => void;
};

function statusLabel(status: VehicleImageMatchIssue["status"]): string {
  switch (status) {
    case "no_vehicle":
      return "No vehicle detected";
    case "mismatch":
      return "Does not match listing";
    case "uncertain":
      return "Needs review";
    default:
      return "Match";
  }
}

export function VehicleImageMismatchDialog({
  open,
  onOpenChange,
  summary,
  issues,
  allowManualConfirm = false,
  onRejectImages,
  onCorrect,
  onManualConfirm,
}: VehicleImageMismatchDialogProps) {
  const flagged = issues.filter(
    (issue) =>
      issue.status === "mismatch" ||
      issue.status === "no_vehicle" ||
      issue.status === "uncertain"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Photos need correction</DialogTitle>
          <DialogDescription className="whitespace-pre-line">{summary}</DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {flagged.map((issue, index) => (
            <div
              key={`${issue.url || "empty"}-${index}`}
              className="flex gap-3 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] p-3"
            >
              {issue.url ? (
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-[var(--platform-surface)]">
                  <SafeVehicleImage
                    src={issue.url}
                    alt="Flagged listing photo"
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                </div>
              ) : (
                <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md bg-[var(--platform-surface)] text-xs text-[var(--platform-text-secondary)]">
                  No photo
                </div>
              )}
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-[var(--platform-error)]">
                  {statusLabel(issue.status)}
                </p>
                <p className="text-xs text-[var(--platform-text-secondary)]">{issue.reason}</p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            onClick={() => {
              onRejectImages();
              onOpenChange(false);
            }}
          >
            Reject flagged photos
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              onCorrect();
              onOpenChange(false);
            }}
          >
            Correct listing details / replace photos
          </Button>
          {allowManualConfirm && onManualConfirm ? (
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                onManualConfirm();
                onOpenChange(false);
              }}
            >
              I reviewed — photos match this vehicle
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
