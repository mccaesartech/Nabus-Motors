import type { Vehicle } from "@/lib/types";
import { formatMileage } from "@/lib/format";
import { cn } from "@/lib/utils";

type NabusSpecStripProps = {
  vehicle: Vehicle;
  className?: string;
};

export function NabusSpecStrip({ vehicle, className }: NabusSpecStripProps) {
  const items = [
    { label: "Year", value: String(vehicle.year) },
    { label: "Mileage", value: formatMileage(vehicle.mileage) },
    { label: "Transmission", value: vehicle.transmission },
    { label: "Fuel", value: vehicle.fuelType },
    ...(vehicle.id
      ? [{ label: "Stock", value: `#${vehicle.id.slice(0, 8).toUpperCase()}` }]
      : []),
  ];

  return (
    <div
      className={cn(
        "flex flex-wrap gap-x-6 gap-y-2 border-y border-[var(--nabus-border)] py-4",
        className
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--nabus-muted)]">
            {item.label}
          </p>
          <p className="mt-0.5 font-mono text-sm text-[var(--nabus-graphite)]">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
