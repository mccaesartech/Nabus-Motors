"use client";

import { Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/platform/status-badge";
import { VEHICLE_STATUSES, VEHICLE_STATUS_LABELS } from "@/lib/admin/vehicle-fields";
import { cn } from "@/lib/utils";

type VehicleStatusControlProps = {
  status: string;
  editable?: boolean;
  loading?: boolean;
  compact?: boolean;
  onStatusChange?: (status: string) => void;
  className?: string;
};

export function VehicleStatusControl({
  status,
  editable = false,
  loading = false,
  compact = false,
  onStatusChange,
  className,
}: VehicleStatusControlProps) {
  if (!editable) {
    return <StatusBadge status={status} className={className} />;
  }

  return (
    <div className={cn("relative inline-flex min-w-[7.5rem] max-w-full", className)}>
      <select
        value={status}
        disabled={loading}
        onChange={(e) => {
          const next = e.target.value;
          if (next !== status) onStatusChange?.(next);
        }}
        className={cn(
          "platform-select w-full min-h-9 touch-manipulation text-xs sm:text-sm",
          compact && "py-1.5 pr-8"
        )}
        aria-label="Vehicle status"
        title="Change listing status"
      >
        {VEHICLE_STATUSES.map((value) => (
          <option key={value} value={value}>
            {VEHICLE_STATUS_LABELS[value] ?? value}
          </option>
        ))}
      </select>
      {loading && (
        <span
          className="pointer-events-none absolute inset-y-0 right-2 flex items-center"
          aria-hidden
        >
          <Loader2 className="size-3.5 animate-spin text-[var(--platform-accent)]" />
        </span>
      )}
    </div>
  );
}
