/** Platform admin timestamps — Ghana business timezone, British English formatting. */
export const PLATFORM_TIMEZONE = "Africa/Accra";
export const PLATFORM_LOCALE = "en-GB";

function parseIso(iso?: string | null): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

const dateTimeFormatter = new Intl.DateTimeFormat(PLATFORM_LOCALE, {
  timeZone: PLATFORM_TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const dateFormatter = new Intl.DateTimeFormat(PLATFORM_LOCALE, {
  timeZone: PLATFORM_TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** e.g. "23 Jun 2026, 2:45 pm" */
export function formatPlatformDateTime(iso?: string | null): string {
  const date = parseIso(iso);
  if (!date) return "—";
  return dateTimeFormatter.format(date);
}

/** e.g. "23 Jun 2026" */
export function formatPlatformDate(iso?: string | null): string {
  const date = parseIso(iso);
  if (!date) return "—";
  return dateFormatter.format(date);
}

/** Compact relative label, e.g. "2 hr ago" */
export function formatRelativeTime(iso?: string | null): string {
  const date = parseIso(iso);
  if (!date) return "—";

  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;

  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;

  return formatPlatformDate(iso);
}

export function platformDateTimeTooltip(iso?: string | null): string | undefined {
  if (!iso) return undefined;
  return formatRelativeTime(iso);
}

export function platformRelativeTooltip(iso?: string | null): string | undefined {
  if (!iso) return undefined;
  return formatPlatformDateTime(iso);
}
