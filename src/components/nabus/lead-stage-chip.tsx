import { cn } from "@/lib/utils";

const LEAD_STAGE_STYLES: Record<string, string> = {
  new: "bg-[var(--nabus-red-soft)] text-[var(--nabus-primary)] border-[var(--nabus-primary)]/20",
  contacted: "bg-[var(--nabus-yellow-soft)] text-[var(--nabus-charcoal)] border-[var(--nabus-yellow)]/40",
  qualified: "bg-[rgba(22,163,74,0.1)] text-green-700 border-green-200/60",
  won: "bg-[var(--nabus-charcoal)]/8 text-[var(--nabus-charcoal)] border-[var(--nabus-border)]",
  lost: "bg-[var(--nabus-background)] text-[var(--nabus-text-secondary)] border-[var(--nabus-border)]",
  pending: "bg-[var(--nabus-yellow-soft)] text-[var(--nabus-charcoal)] border-[var(--nabus-yellow)]/40",
  confirmed: "bg-[rgba(22,163,74,0.1)] text-green-700 border-green-200/60",
  cancelled: "bg-[var(--nabus-background)] text-[var(--nabus-text-secondary)] border-[var(--nabus-border)]",
};

type LeadStageChipProps = {
  status: string;
  className?: string;
};

export function LeadStageChip({ status, className }: LeadStageChipProps) {
  const key = status.toLowerCase().replace(/\s+/g, "_");
  const label = status.replace(/_/g, " ");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        LEAD_STAGE_STYLES[key] ?? LEAD_STAGE_STYLES.new,
        className
      )}
    >
      {label}
    </span>
  );
}
