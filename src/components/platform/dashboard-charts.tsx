"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/platform/dashboard/empty-state";
import { platformTokens } from "@/lib/platform/design-tokens";
import {
  bucketLabelForRange,
  getRangeStart,
  isDateInRange,
  type ChartTimeRange,
} from "@/lib/platform/chart-time-range";
import { platformPath } from "@/lib/platform/paths";
import type { DbVehicle, PlatformStats } from "@/lib/platform/types";
import { usePlatformCurrency } from "@/context/platform-currency-context";

const CHART_ANIMATION = { animationDuration: 700, animationEasing: "ease-out" as const };

type PieChartDatum = {
  name: string;
  value: number;
  fill: string;
};

function ChartSurface({ children }: { children: ReactNode }) {
  return (
    <div className="platform-chart-surface w-full max-w-full min-w-0 overflow-x-clip">
      {children}
    </div>
  );
}

/**
 * Native SVG donut — Recharts 3 Pie + ResponsiveContainer often yields a null polar layout
 * (zero-size parent / overflow clipping), leaving "circles" blank even when data exists.
 * Uses viewBox + max-width so portrait phones never force horizontal page scroll.
 */
function DonutChart({
  data,
  total,
  size = 176,
  thickness = 28,
  centerLabel,
}: {
  data: PieChartDatum[];
  total: number;
  size?: number;
  thickness?: number;
  centerLabel?: string;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = data.length > 1 ? Math.min(6, circumference * 0.012) : 0;
  let offset = 0;

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[11rem]"
      style={{ maxWidth: size }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="block size-full max-w-full"
        role="img"
        aria-label={centerLabel ? `${centerLabel}: ${total}` : `Total ${total}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--platform-bg-secondary)"
          strokeWidth={thickness}
        />
        {data.map((item) => {
          const fraction = total > 0 ? item.value / total : 0;
          const arc = Math.max(0, fraction * circumference - gap);
          const el = (
            <circle
              key={item.name}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.fill}
              strokeWidth={thickness}
              strokeLinecap="butt"
              strokeDasharray={`${arc} ${Math.max(0, circumference - arc)}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += fraction * circumference;
          return el;
        })}
      </svg>
      {centerLabel != null && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2">
          <span className="text-xl font-semibold tabular-nums text-[var(--platform-text)] sm:text-2xl">
            {total}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--platform-text-secondary)]">
            {centerLabel}
          </span>
        </div>
      )}
    </div>
  );
}

function PipelineBars({
  data,
}: {
  data: Array<{ stage: string; count: number; fill: string }>;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <ul className="space-y-3 py-1" aria-label="Lead pipeline stages">
      {data.map((item) => {
        const widthPct = Math.max(item.count > 0 ? 8 : 0, Math.round((item.count / max) * 100));
        return (
          <li key={item.stage}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-[var(--platform-text)]">{item.stage}</span>
              <span className="tabular-nums font-semibold text-[var(--platform-text-secondary)]">
                {item.count}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--platform-bg-secondary)]">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${widthPct}%`, backgroundColor: item.fill }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type ChartTooltipProps = {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    payload?: { stage?: string; name?: string; count?: number; value?: number; label?: string };
  }>;
  label?: string;
  total?: number;
  valueLabel?: string;
  formatValue?: (v: number) => string;
};

function ChartTooltip({
  active,
  payload,
  label,
  total,
  valueLabel = "Count",
  formatValue,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const entry = payload[0];
  const raw = entry.value ?? entry.payload?.count ?? entry.payload?.value ?? 0;
  const value = formatValue ? formatValue(Number(raw)) : raw;
  const displayName =
    label ?? entry.payload?.label ?? entry.payload?.stage ?? entry.payload?.name ?? entry.name ?? "";

  const percentage =
    total && total > 0 ? Math.round((Number(raw) / total) * 100) : null;

  return (
    <div
      className="z-50 rounded-lg border border-[var(--platform-border)] bg-white px-3 py-2 shadow-lg"
      style={{ pointerEvents: "none" }}
    >
      <p className="text-sm font-semibold text-[var(--platform-text)]">{displayName}</p>
      <p className="mt-0.5 text-sm text-[var(--platform-text)]">
        {valueLabel}: <span className="font-semibold">{value}</span>
        {percentage !== null && (
          <span className="font-medium text-[var(--platform-accent)]"> ({percentage}%)</span>
        )}
      </p>
    </div>
  );
}

const TOOLTIP_WRAPPER_STYLE = { zIndex: 50 };

const INVENTORY_COLORS: Record<string, string> = {
  Available: platformTokens.semantic.info,
  "Pre-order (awaiting payment)": platformTokens.semantic.warning,
  "Pre-order (deposit paid)": platformTokens.semantic.success,
  Reserved: platformTokens.semantic.danger,
  Sold: platformTokens.semantic.neutral,
};

const LEAD_STAGE_COLORS: Record<string, string> = {
  New: platformTokens.semantic.info,
  Contacted: platformTokens.primary.purple,
  Qualified: platformTokens.semantic.warning,
  Won: platformTokens.semantic.success,
  Lost: platformTokens.semantic.neutral,
};

const CATEGORY_COLORS = [
  platformTokens.primary.purple,
  platformTokens.semantic.info,
  platformTokens.semantic.success,
  platformTokens.semantic.warning,
  platformTokens.semantic.neutral,
  "#ec4899",
  "#14b8a6",
];

function PieChartLegend({ items, total }: { items: PieChartDatum[]; total: number }) {
  if (!items.length) return null;

  return (
    <ul
      className="platform-insight-legend mt-2 flex w-full max-w-full min-w-0 flex-col gap-1.5 text-xs text-[var(--platform-text-secondary)]"
      aria-label="Chart legend"
    >
      {items.map((item) => {
        const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
        return (
          <li
            key={item.name}
            className="flex min-w-0 max-w-full items-start gap-1.5"
          >
            <span
              className="mt-1 inline-block size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.fill }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 break-words font-medium text-[var(--platform-text)]">
              {item.name}
            </span>
            <span className="shrink-0 rounded-full bg-[var(--platform-bg-secondary)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--platform-text)]">
              {item.value}
            </span>
            <span className="shrink-0 text-[10px] font-medium text-[var(--platform-accent)]">
              {pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

type InventoryChartProps = {
  available: number;
  preOrderPending: number;
  preOrderConfirmed: number;
  reserved: number;
  sold: number;
};

export function InventoryStatusChart({
  available,
  preOrderPending,
  preOrderConfirmed,
  reserved,
  sold,
}: InventoryChartProps) {
  const data: PieChartDatum[] = [
    { name: "Available", value: available },
    { name: "Pre-order (awaiting payment)", value: preOrderPending },
    { name: "Pre-order (deposit paid)", value: preOrderConfirmed },
    { name: "Reserved", value: reserved },
    { name: "Sold", value: sold },
  ]
    .filter((d) => d.value > 0)
    .map((entry) => ({
      ...entry,
      fill: INVENTORY_COLORS[entry.name] ?? platformTokens.semantic.neutral,
    }));

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0) {
    return (
      <EmptyState
        title="No inventory yet"
        description="Add vehicles to your fleet to see availability breakdown."
        actionLabel="Add vehicle"
        actionHref={platformPath("inventory/new")}
        compact
      />
    );
  }

  return (
    <ChartSurface>
      <DonutChart data={data} total={total} centerLabel="Fleet" />
      <PieChartLegend items={data} total={total} />
    </ChartSurface>
  );
}

type LeadChartProps = {
  newLeads: number;
  contacted: number;
  qualified: number;
  won: number;
  lost: number;
};

export function LeadPipelineChart({
  newLeads,
  contacted,
  qualified,
  won,
  lost,
}: LeadChartProps) {
  const data = [
    { stage: "New", count: newLeads, fill: LEAD_STAGE_COLORS.New },
    { stage: "Contacted", count: contacted, fill: LEAD_STAGE_COLORS.Contacted },
    { stage: "Qualified", count: qualified, fill: LEAD_STAGE_COLORS.Qualified },
    { stage: "Won", count: won, fill: LEAD_STAGE_COLORS.Won },
    { stage: "Lost", count: lost, fill: LEAD_STAGE_COLORS.Lost },
  ];

  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <EmptyState
        title="No leads yet"
        description="Customer inquiries from contact, vehicle, finance, and pre-order forms will appear here."
        actionLabel="View leads"
        actionHref={platformPath("leads")}
        compact
      />
    );
  }

  const activeTotal = newLeads + contacted + qualified;

  return (
    <ChartSurface>
      <PipelineBars data={data} />
      <p className="mt-3 text-center text-[10px] font-medium text-[var(--platform-text-secondary)]">
        {activeTotal} active in pipeline · {total} total inquiries
      </p>
    </ChartSurface>
  );
}

function buildTimeBuckets(vehicles: DbVehicle[], range: ChartTimeRange, valueFn: (v: DbVehicle) => number) {
  const now = new Date();
  const filtered = vehicles.filter((v) => isDateInRange(v.created_at, range, now));
  const buckets = new Map<string, number>();

  for (const v of filtered) {
    const d = new Date(v.created_at ?? now);
    const label = bucketLabelForRange(range, d);
    buckets.set(label, (buckets.get(label) ?? 0) + valueFn(v));
  }

  if (buckets.size === 0) {
    return [{ label: "No data", value: 0 }];
  }

  return [...buckets.entries()].map(([label, value]) => ({ label, value }));
}

export function SalesTrendChart({
  vehicles,
  range,
}: {
  vehicles: DbVehicle[];
  range: ChartTimeRange;
}) {
  const data = useMemo(
    () => buildTimeBuckets(vehicles, range, () => 1),
    [vehicles, range]
  );

  if (!data.length || (data.length === 1 && data[0].label === "No data")) {
    return null;
  }

  return (
    <ChartSurface>
      <div className="h-[200px] w-full min-w-0 max-w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
          <LineChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 4 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: "#a78bfa", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              angle={-30}
              textAnchor="end"
              height={44}
              minTickGap={8}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#a78bfa", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              content={<ChartTooltip valueLabel="Sales" />}
              wrapperStyle={TOOLTIP_WRAPPER_STYLE}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={platformTokens.primary.purple}
              strokeWidth={2}
              dot={{ r: 3, fill: platformTokens.primary.purple }}
              activeDot={{ r: 5 }}
              {...CHART_ANIMATION}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartSurface>
  );
}

export function RevenueTrendChart({
  vehicles,
  range,
}: {
  vehicles: DbVehicle[];
  range: ChartTimeRange;
}) {
  const { formatPrice } = usePlatformCurrency();
  const data = useMemo(
    () => buildTimeBuckets(vehicles, range, (v) => v.price ?? 0),
    [vehicles, range]
  );

  if (!data.length || (data.length === 1 && data[0].label === "No data")) {
    return null;
  }

  return (
    <ChartSurface>
      <div className="h-[200px] w-full min-w-0 max-w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
          <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 4 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: "#a78bfa", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              angle={-30}
              textAnchor="end"
              height={44}
              minTickGap={8}
            />
            <YAxis
              tick={{ fill: "#a78bfa", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={36}
              tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            />
            <Tooltip
              content={
                <ChartTooltip
                  valueLabel="Revenue"
                  formatValue={(v) => formatPrice(v)}
                />
              }
              wrapperStyle={TOOLTIP_WRAPPER_STYLE}
              cursor={{ fill: "rgba(139,92,246,0.08)" }}
            />
            <Bar
              dataKey="value"
              fill={platformTokens.semantic.success}
              radius={[4, 4, 0, 0]}
              {...CHART_ANIMATION}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartSurface>
  );
}

export function VehicleCategoriesChart({ vehicles }: { vehicles: DbVehicle[] }) {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of vehicles) {
      const cat = v.body_type || "Other";
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((entry, i) => ({
        ...entry,
        fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }));
  }, [vehicles]);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) {
    return (
      <EmptyState
        title="No vehicles to categorize"
        description="List vehicles with body types to see category distribution."
        actionLabel="Manage inventory"
        actionHref={platformPath("inventory")}
        compact
      />
    );
  }

  return (
    <ChartSurface>
      <DonutChart data={data} total={total} centerLabel="Types" />
      <PieChartLegend items={data} total={total} />
    </ChartSurface>
  );
}

export function FreightStatusChart({
  pending,
  delayed,
  quotes,
}: {
  pending: number;
  delayed: number;
  quotes: number;
}) {
  const data = [
    { name: "Pending", value: pending, color: platformTokens.semantic.warning },
    { name: "Delayed", value: delayed, color: platformTokens.semantic.danger },
    { name: "Open quotes", value: quotes, color: platformTokens.semantic.info },
  ].filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (!total) {
    return (
      <EmptyState
        title="Freight pipeline clear"
        description="No pending shipments or open quotes right now."
        actionLabel="Freight dashboard"
        actionHref={platformPath("freight/orders")}
        compact
      />
    );
  }

  return (
    <ChartSurface>
      <div className="h-[200px] w-full min-w-0 max-w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={72}
              tick={{ fill: "#7c6b9e", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (String(v).length > 10 ? `${String(v).slice(0, 9)}…` : String(v))}
            />
            <Tooltip content={<ChartTooltip total={total} />} wrapperStyle={TOOLTIP_WRAPPER_STYLE} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18} {...CHART_ANIMATION}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartSurface>
  );
}

export function RecentOrdersList({
  vehicles,
  showPrices = true,
}: {
  vehicles: DbVehicle[];
  showPrices?: boolean;
}) {
  const orders = useMemo(
    () =>
      vehicles
        .filter((v) => v.status === "sold" || v.status === "reserved")
        .sort(
          (a, b) =>
            new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
        )
        .slice(0, 5),
    [vehicles]
  );

  const { formatPrice } = usePlatformCurrency();

  if (!orders.length) {
    return (
      <EmptyState
        title="No recent orders"
        description="Reserved and sold vehicles will list here."
        actionLabel="View inventory"
        actionHref={platformPath("inventory")}
        compact
      />
    );
  }

  return (
    <ul className="divide-y divide-[var(--platform-border)]">
      {orders.map((v) => (
        <li key={v.id}>
          <Link
            href={platformPath(`inventory/${v.id}`)}
            className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-[rgba(139,92,246,0.04)]"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-[var(--platform-text)]">
                {v.year} {v.make} {v.model}
              </span>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide ${
                  v.status === "sold" ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                {v.status}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--platform-text)]">
              {showPrices ? formatPrice(v.price) : v.status === "sold" ? "Sold" : "Reserved"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function TopSellingVehicles({ vehicles }: { vehicles: DbVehicle[] }) {
  const top = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const v of vehicles) {
      const key = `${v.make}|${v.model}`;
      const label = `${v.make} ${v.model}`;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { label, count: 1 });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [vehicles]);

  if (!top.length) return null;

  const max = top[0]?.count ?? 1;

  return (
    <ul className="space-y-2.5">
      {top.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium text-[var(--platform-text)]">{item.label}</span>
            <span className="shrink-0 tabular-nums text-xs font-semibold text-[var(--platform-text-secondary)]">
              {item.count} sold
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--platform-bg-secondary)]">
            <div
              className="h-full rounded-full bg-[var(--platform-accent)] platform-chart-bar-grow"
              style={{ width: `${Math.round((item.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MonthlyPerformanceSummary({
  stats,
  extras,
  showFinance = true,
}: {
  stats: PlatformStats;
  extras?: { pendingShipments?: number; freightQuotes?: number };
  showFinance?: boolean;
}) {
  const { formatPrice } = usePlatformCurrency();
  const now = new Date();
  const monthStart = getRangeStart("month", now);

  const metrics = [
    {
      label: "Open leads",
      value: String(stats.totalLeads),
      tone: stats.totalLeads > 0 ? "text-amber-600" : "text-emerald-600",
    },
    {
      label: "Available vehicles",
      value: String(stats.availableVehicles),
      tone: "text-[var(--platform-text)]",
    },
    {
      label: "Sold (lifetime)",
      value: String(stats.soldVehicles ?? 0),
      tone: "text-emerald-600",
    },
    ...(showFinance
      ? [
          {
            label: "Est. revenue",
            value: formatPrice(stats.estimatedRevenue),
            tone: "text-[var(--platform-text)]",
          },
        ]
      : []),
    {
      label: "Pending shipments",
      value: String(extras?.pendingShipments ?? 0),
      tone: (extras?.pendingShipments ?? 0) > 0 ? "text-amber-600" : "text-emerald-600",
    },
    {
      label: "Freight quotes",
      value: String(extras?.freightQuotes ?? 0),
      tone: "text-[var(--platform-text)]",
    },
  ];

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="min-w-0 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg-secondary)]/50 px-3 py-2.5"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--platform-text-secondary)]">
            {m.label}
          </p>
          <p className={`mt-1 break-words text-lg font-semibold tabular-nums ${m.tone}`}>{m.value}</p>
          <p className="mt-0.5 text-[10px] text-[var(--platform-text-secondary)]">
            Since {monthStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </p>
        </div>
      ))}
    </div>
  );
}
