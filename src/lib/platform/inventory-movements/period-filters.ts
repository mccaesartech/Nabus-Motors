import type { MovementPeriod } from "./types";

export type PeriodRange = {
  from: Date;
  to: Date;
  period: MovementPeriod;
};

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)
  );
}

function startOfUtcWeek(date: Date): Date {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = startOfUtcDay(date);
  start.setUTCDate(start.getUTCDate() + diff);
  return start;
}

function endOfUtcWeek(date: Date): Date {
  const start = startOfUtcWeek(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return endOfUtcDay(end);
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfUtcMonth(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999)
  );
}

function startOfUtcYear(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function endOfUtcYear(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 11, 31, 23, 59, 59, 999));
}

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(`${value.trim()}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolvePeriodRange(
  period: MovementPeriod,
  anchor: Date = new Date(),
  fromInput?: string | null,
  toInput?: string | null
): PeriodRange {
  if (period === "range") {
    const from = parseIsoDate(fromInput) ?? startOfUtcMonth(anchor);
    const toRaw = parseIsoDate(toInput) ?? endOfUtcDay(anchor);
    const to = endOfUtcDay(toRaw);
    if (from.getTime() > to.getTime()) {
      return { from: to, to: from, period };
    }
    return { from, to, period };
  }

  if (period === "day") {
    return { from: startOfUtcDay(anchor), to: endOfUtcDay(anchor), period };
  }

  if (period === "week") {
    return { from: startOfUtcWeek(anchor), to: endOfUtcWeek(anchor), period };
  }

  if (period === "month") {
    return { from: startOfUtcMonth(anchor), to: endOfUtcMonth(anchor), period };
  }

  return { from: startOfUtcYear(anchor), to: endOfUtcYear(anchor), period };
}

export function bucketKeyForDate(date: Date, period: MovementPeriod): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");

  if (period === "day") return `${y}-${m}-${d}`;
  if (period === "week") {
    const weekStart = startOfUtcWeek(date);
    const wy = weekStart.getUTCFullYear();
    const wm = String(weekStart.getUTCMonth() + 1).padStart(2, "0");
    const wd = String(weekStart.getUTCDate()).padStart(2, "0");
    return `${wy}-W${wm}-${wd}`;
  }
  if (period === "month") return `${y}-${m}`;
  if (period === "year") return `${y}`;
  return `${y}-${m}-${d}`;
}

export function bucketLabelForKey(key: string, period: MovementPeriod): string {
  if (period === "year") return key;
  if (period === "month") {
    const [year, month] = key.split("-");
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const idx = Number(month) - 1;
    return `${monthNames[idx] ?? month} ${year}`;
  }
  if (period === "week") {
    const match = key.match(/^(\d{4})-W(\d{2})-(\d{2})$/);
    if (match) return `Week of ${match[2]}/${match[3]}/${match[1]}`;
    return key;
  }
  return key;
}

export function bucketBoundsForKey(
  key: string,
  period: MovementPeriod
): { periodStart: string; periodEnd: string } {
  if (period === "year") {
    const year = Number(key);
    return {
      periodStart: new Date(Date.UTC(year, 0, 1)).toISOString(),
      periodEnd: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)).toISOString(),
    };
  }

  if (period === "month") {
    const [yearStr, monthStr] = key.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr) - 1;
    return {
      periodStart: new Date(Date.UTC(year, month, 1)).toISOString(),
      periodEnd: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)).toISOString(),
    };
  }

  if (period === "week") {
    const match = key.match(/^(\d{4})-W(\d{2})-(\d{2})$/);
    if (match) {
      const start = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);
      return {
        periodStart: start.toISOString(),
        periodEnd: endOfUtcDay(end).toISOString(),
      };
    }
  }

  const day = new Date(`${key}T00:00:00.000Z`);
  return {
    periodStart: day.toISOString(),
    periodEnd: endOfUtcDay(day).toISOString(),
  };
}

export function toIsoDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}
