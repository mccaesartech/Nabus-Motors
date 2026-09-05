import { cn } from "@/lib/utils";
import { NabusArc } from "./nabus-arc";

type NabusSectionLabelProps = {
  children: React.ReactNode;
  className?: string;
  showArc?: boolean;
  tone?: "default" | "dark" | "gold";
};

export function NabusSectionLabel({
  children,
  className,
  showArc = true,
  tone = "default",
}: NabusSectionLabelProps) {
  const toneClass =
    tone === "dark"
      ? "text-[var(--nabus-gold)]"
      : tone === "gold"
        ? "text-[var(--nabus-gold)]"
        : "text-[var(--nabus-muted)]";

  return (
    <div className={cn("inline-flex flex-col gap-2", className)}>
      <span
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[0.2em]",
          toneClass
        )}
      >
        {children}
      </span>
      {showArc ? <NabusArc width={72} variant={tone === "dark" ? "gold" : "subtle"} /> : null}
    </div>
  );
}
