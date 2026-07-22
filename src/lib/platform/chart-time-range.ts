export type ChartTimeRange = "today" | "week" | "month" | "year";

export const CHART_TIME_RANGES: { key: ChartTimeRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
];

export function getRangeStart(range: ChartTimeRange, now = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (range) {
    case "today":
      return start;
    case "week": {
      const day = start.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diff);
      return start;
    }
    case "month":
      start.setDate(1);
      return start;
    case "year":
      start.setMonth(0, 1);
      return start;
  }
}

export function isDateInRange(dateStr: string | undefined, range: ChartTimeRange, now = new Date()): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const start = getRangeStart(range, now);
  return d >= start && d <= now;
}

export function bucketLabelForRange(range: ChartTimeRange, date: Date): string {
  if (range === "today") {
    return date.toLocaleTimeString(undefined, { hour: "numeric" });
  }
  if (range === "year") {
    return date.toLocaleDateString(undefined, { month: "short" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
