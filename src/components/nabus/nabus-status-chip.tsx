import { cn } from "@/lib/utils";
import { availabilityLabel } from "@/lib/vehicles/availability";

type NabusStatusChipProps = {
  status?: string | null;
  className?: string;
  size?: "sm" | "md";
};

const STATUS_STYLES: Record<string, string> = {
  available: "bg-[var(--nabus-red-soft)] text-[var(--nabus-primary)] border-[var(--nabus-primary)]/20",
  pre_order: "bg-[var(--nabus-yellow-soft)] text-[var(--nabus-charcoal)] border-[var(--nabus-yellow)]/40",
  reserved: "bg-[var(--nabus-background)] text-[var(--nabus-text-secondary)] border-[var(--nabus-border)]",
  sold: "bg-[var(--nabus-charcoal)]/8 text-[var(--nabus-text-secondary)] border-[var(--nabus-border)]",
};

export function NabusStatusChip({
  status,
  className,
  size = "sm",
}: NabusStatusChipProps) {
  const key = status ?? "available";
  const label = availabilityLabel(status);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold tracking-wide",
        size === "sm" ? "px-2 py-0.5 text-[10px] uppercase" : "px-2.5 py-1 text-xs",
        STATUS_STYLES[key] ?? STATUS_STYLES.available,
        className
      )}
    >
      {label}
    </span>
  );
}
