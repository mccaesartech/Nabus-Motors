"use client";

import { SHIPMENT_STATUS_HINTS } from "@/lib/platform/shipment-event-presets";
import {
  SHIPMENT_STATUSES,
  shipmentStatusLabel,
  type ShipmentStatus,
} from "@/lib/platform/shipment";

type ShipmentStatusSelectProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  inline?: boolean;
};

export function ShipmentStatusSelect({
  value,
  onChange,
  disabled,
  inline = false,
}: ShipmentStatusSelectProps) {
  const hint = SHIPMENT_STATUS_HINTS[value as ShipmentStatus];

  if (inline) {
    return (
      <select
        className="platform-select min-w-[9.5rem] text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        title={hint}
        aria-label="Shipment status"
      >
        {SHIPMENT_STATUSES.map((s) => (
          <option key={s} value={s} title={SHIPMENT_STATUS_HINTS[s]}>
            {shipmentStatusLabel(s)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-[var(--platform-text-secondary)]">Status</span>
      <select
        className="platform-select w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        title={hint}
      >
        {SHIPMENT_STATUSES.map((s) => (
          <option key={s} value={s} title={SHIPMENT_STATUS_HINTS[s]}>
            {shipmentStatusLabel(s)}
          </option>
        ))}
      </select>
    </label>
  );
}
