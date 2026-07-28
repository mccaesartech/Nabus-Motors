"use client";

import { useEffect, useState } from "react";
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
import type { VehiclePublishSummary } from "@/lib/admin/vehicle-publish-gates";
import { formatAmount } from "@/lib/currency";

type VehiclePublishConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: VehiclePublishSummary;
  mode: "publish" | "approve";
  onConfirm: () => void | Promise<void>;
};

export function VehiclePublishConfirmDialog({
  open,
  onOpenChange,
  summary,
  mode,
  onConfirm,
}: VehiclePublishConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setConfirmed(false);
      setBusy(false);
    }
  }, [open]);

  async function handleConfirm() {
    if (!confirmed || busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  const rows: Array<{ label: string; value: string }> = [
    {
      label: "Price",
      value: formatAmount(summary.price, summary.priceCurrency),
    },
    { label: "Mileage", value: `${summary.mileage.toLocaleString()} km` },
    { label: "Color", value: summary.color },
    { label: "Status", value: summary.statusLabel },
    { label: "Location", value: summary.location },
    { label: "Body", value: summary.bodyType },
    { label: "Fuel", value: summary.fuelType },
    { label: "Transmission", value: summary.transmission },
    { label: "Condition", value: summary.condition },
    {
      label: "Photos",
      value: `${summary.photoCount} photo${summary.photoCount === 1 ? "" : "s"}`,
    },
    { label: "Featured", value: summary.featured ? "Yes" : "No" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "approve" ? "Confirm approval" : "Confirm before publishing"}
          </DialogTitle>
          <DialogDescription>
            {mode === "approve"
              ? "Review the full listing details. Approving publishes this vehicle to the public website."
              : "Review the full listing details. Confirming publishes this vehicle to the public website."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg)] p-3">
            {summary.primaryImageUrl ? (
              <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-md bg-[var(--platform-surface)]">
                <SafeVehicleImage
                  src={summary.primaryImageUrl}
                  alt={summary.title}
                  fill
                  className="object-cover"
                  sizes="112px"
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--platform-text)]">{summary.title}</p>
              <p className="mt-1 text-xs text-[var(--platform-text-secondary)]">
                Double-check price, photos, color, and availability before going live.
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {rows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-[var(--platform-text-secondary)]">{row.label}</dt>
                <dd className="font-medium text-[var(--platform-text)]">{row.value}</dd>
              </div>
            ))}
          </dl>

          <label className="flex items-start gap-2 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 py-2.5 text-sm text-[var(--platform-text)]">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 size-4 rounded border-[var(--platform-border)] accent-[var(--platform-accent)]"
            />
            <span>
              I confirm these details and photos are correct and ready for the public website.
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={!confirmed || busy} onClick={() => void handleConfirm()}>
            {busy
              ? "Working…"
              : mode === "approve"
                ? "Approve & publish"
                : "Publish to website"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
