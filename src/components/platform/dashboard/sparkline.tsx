"use client";

import { useMemo } from "react";
import { platformTokens } from "@/lib/platform/design-tokens";
import { cn } from "@/lib/utils";

type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  className?: string;
  filled?: boolean;
};

export function Sparkline({
  data,
  width = 72,
  height = 28,
  stroke = platformTokens.primary.purple,
  className,
  filled = true,
}: SparklineProps) {
  const { linePath, areaPath } = useMemo(() => {
    if (!data.length) return { linePath: "", areaPath: "" };

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const pad = 2;
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;

    const points = data.map((v, i) => {
      const x = pad + (i / Math.max(data.length - 1, 1)) * innerW;
      const y = pad + innerH - ((v - min) / range) * innerH;
      return { x, y };
    });

    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const area = `${line} L${points[points.length - 1].x.toFixed(1)},${height - pad} L${points[0].x.toFixed(1)},${height - pad} Z`;

    return { linePath: line, areaPath: area };
  }, [data, width, height]);

  if (!data.length) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      {filled && areaPath && (
        <path d={areaPath} fill={stroke} fillOpacity={0.12} className="platform-chart-fade-in" />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="platform-chart-fade-in"
      />
    </svg>
  );
}

/** Deterministic mini-series for KPI decoration when historical API data is unavailable. */
export function deriveSparklineSeries(seed: number, length = 7): number[] {
  const base = Math.max(seed, 1);
  return Array.from({ length }, (_, i) => {
    const wave = Math.sin((seed + i) * 0.7) * 0.15 + 1;
    const trend = 0.85 + (i / length) * 0.3;
    return Math.round(base * wave * trend * (0.9 + ((seed * (i + 1)) % 7) / 35));
  });
}
