"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartTooltipProps = {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    payload?: { stage?: string; name?: string; count?: number; value?: number };
  }>;
  label?: string;
  total?: number;
  valueLabel?: string;
};

function ChartTooltip({
  active,
  payload,
  label,
  total,
  valueLabel = "Count",
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const entry = payload[0];
  const value = entry.value ?? entry.payload?.count ?? entry.payload?.value ?? 0;
  const displayName =
    label ?? entry.payload?.stage ?? entry.payload?.name ?? entry.name ?? "";
  const percentage =
    total && total > 0 ? Math.round((Number(value) / total) * 100) : null;

  return (
    <div
      className="z-50 rounded-lg border border-[#8B5CF6] bg-white px-3 py-2 shadow-lg"
      style={{ pointerEvents: "none" }}
    >
      <p className="text-sm font-semibold text-[#1a1a1a]">{displayName}</p>
      <p className="mt-0.5 text-sm text-[#1a1a1a]">
        {valueLabel}: <span className="font-semibold">{value}</span>
        {percentage !== null && (
          <span className="font-medium text-[#6B21A8]"> ({percentage}%)</span>
        )}
      </p>
    </div>
  );
}

const TOOLTIP_WRAPPER_STYLE = { zIndex: 50 };

const INVENTORY_COLORS: Record<string, string> = {
  Available: "#2563EB",
  "Pre-order (awaiting payment)": "#F59E0B",
  "Pre-order (deposit paid)": "#22C55E",
  Reserved: "#EF4444",
  Sold: "#737373",
};

const LEAD_STAGE_COLORS: Record<string, string> = {
  Contact: "#2563EB",
  Vehicle: "#8B5CF6",
  "Pre-Order": "#22C55E",
  Finance: "#F59E0B",
  "Trade-in": "#737373",
};

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
  const data = [
    { name: "Available", value: available },
    { name: "Pre-order (awaiting payment)", value: preOrderPending },
    { name: "Pre-order (deposit paid)", value: preOrderConfirmed },
    { name: "Reserved", value: reserved },
    { name: "Sold", value: sold },
  ].filter((d) => d.value > 0);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--platform-text-secondary)]">
        No inventory data yet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={78}
          paddingAngle={0}
          strokeWidth={0}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={INVENTORY_COLORS[entry.name]} />
          ))}
        </Pie>
        <Tooltip
          content={<ChartTooltip total={total} valueLabel="Vehicles" />}
          wrapperStyle={TOOLTIP_WRAPPER_STYLE}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

type LeadChartProps = {
  contact: number;
  vehicle: number;
  preorder: number;
  finance: number;
  appraisal: number;
};

export function LeadPipelineChart({
  contact,
  vehicle,
  preorder,
  finance,
  appraisal,
}: LeadChartProps) {
  const data = [
    { stage: "Contact", count: contact },
    { stage: "Vehicle", count: vehicle },
    { stage: "Pre-Order", count: preorder },
    { stage: "Finance", count: finance },
    { stage: "Trade-in", count: appraisal },
  ];

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <XAxis
          dataKey="stage"
          tick={{ fill: "#C4B5FD", fontSize: 11, opacity: 0.75 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "#C4B5FD", fontSize: 11, opacity: 0.75 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={<ChartTooltip total={total} />}
          wrapperStyle={TOOLTIP_WRAPPER_STYLE}
          cursor={{ fill: "rgba(139,92,246,0.12)" }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.stage} fill={LEAD_STAGE_COLORS[entry.stage]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
