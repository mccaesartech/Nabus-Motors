"use client";

import {
  colorLabelForImageUrl,
  VEHICLE_COLOR_OPTIONS,
} from "@/lib/vehicles/vehicle-colors";
import { VehicleColorSwatch } from "@/components/shared/vehicle-color-swatch";

type VehicleColorFieldProps = {
  value: string;
  onChange: (value: string) => void;
  primaryImageUrl?: string | null;
  className?: string;
  selectClassName?: string;
  inputClassName?: string;
};

export function VehicleColorField({
  value,
  onChange,
  primaryImageUrl,
  className = "",
  selectClassName = "",
  inputClassName = "",
}: VehicleColorFieldProps) {
  const suggested = colorLabelForImageUrl(primaryImageUrl ?? undefined);
  const knownLabels = new Set(VEHICLE_COLOR_OPTIONS.map((opt) => opt.label));
  const selectValue = knownLabels.has(value) ? value : value.trim() ? "__custom__" : "";

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <VehicleColorSwatch color={value || suggested || ""} size="md" />
        <select
          value={selectValue}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "__custom__") {
              onChange(value && !knownLabels.has(value) ? value : "");
              return;
            }
            onChange(next);
          }}
          className={selectClassName}
          aria-label="Exterior color"
        >
          <option value="">Select color…</option>
          {VEHICLE_COLOR_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.label}>
              {opt.label}
            </option>
          ))}
          <option value="__custom__">Custom…</option>
        </select>
      </div>

      {selectValue === "__custom__" && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
          placeholder="e.g. Alpine White"
          aria-label="Custom exterior color"
        />
      )}

      {suggested && suggested !== value && (
        <button
          type="button"
          onClick={() => onChange(suggested)}
          className="text-left text-xs text-[var(--platform-accent,#7c3aed)] underline-offset-2 hover:underline"
        >
          Match primary photo: {suggested}
        </button>
      )}
    </div>
  );
}
