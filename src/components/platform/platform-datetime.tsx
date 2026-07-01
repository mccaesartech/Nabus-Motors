import { cn } from "@/lib/utils";
import {
  formatPlatformDate,
  formatPlatformDateTime,
  formatRelativeTime,
  platformDateTimeTooltip,
  platformRelativeTooltip,
} from "@/lib/platform/datetime";

type PlatformDateTimeProps = {
  value?: string | null;
  /** Absolute datetime (default), date only, or relative primary text */
  mode?: "datetime" | "date" | "relative";
  className?: string;
  /** Extra context prepended to the hover title */
  prefix?: string;
};

export function PlatformDateTime({
  value,
  mode = "datetime",
  className,
  prefix,
}: PlatformDateTimeProps) {
  if (!value) {
    return <span className={cn("text-[var(--platform-text-secondary)]", className)}>—</span>;
  }

  const display =
    mode === "date"
      ? formatPlatformDate(value)
      : mode === "relative"
        ? formatRelativeTime(value)
        : formatPlatformDateTime(value);

  const hover =
    mode === "relative" ? platformRelativeTooltip(value) : platformDateTimeTooltip(value);
  const title = [prefix, hover].filter(Boolean).join(" · ") || undefined;

  return (
    <time dateTime={value} title={title} className={cn("whitespace-nowrap", className)}>
      {display}
    </time>
  );
}

type PlatformDateLabelProps = {
  label: string;
  value?: string | null;
  mode?: "datetime" | "date";
  className?: string;
};

/** Labelled timestamp for detail panels — e.g. "Created", "Last updated". */
export function PlatformDateLabel({
  label,
  value,
  mode = "datetime",
  className,
}: PlatformDateLabelProps) {
  return (
    <div className={className}>
      <p className="text-xs text-[var(--platform-text-secondary)]">{label}</p>
      <PlatformDateTime value={value} mode={mode} className="text-sm text-[var(--platform-text)]" />
    </div>
  );
}
