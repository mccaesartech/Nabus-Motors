"use client";

import { useEffect, useRef, useState } from "react";
import { platformTokens } from "@/lib/platform/design-tokens";
import { cn } from "@/lib/utils";

type TrendDirection = "up" | "down" | "flat";

type KpiTrendProps = {
  percent: number;
  direction?: TrendDirection;
  className?: string;
};

export function KpiTrend({ percent, direction, className }: KpiTrendProps) {
  const resolved: TrendDirection =
    direction ?? (percent > 0 ? "up" : percent < 0 ? "down" : "flat");
  const abs = Math.abs(Math.round(percent));
  if (resolved === "flat" || abs === 0) return null;

  const tone =
    resolved === "up"
      ? "text-emerald-600"
      : resolved === "down"
        ? "text-red-600"
        : "text-[var(--platform-text-secondary)]";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        tone,
        className
      )}
    >
      {resolved === "up" ? "+" : "−"}
      {abs}%
    </span>
  );
}

type AnimatedCounterProps = {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
};

export function AnimatedCounter({
  value,
  format = (n) => String(n),
  duration = 600,
  className,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = null;

    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (value - fromRef.current) * eased;
      setDisplay(next);
      if (t < 1) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate from last rendered value
  }, [value, duration]);

  return <span className={className}>{format(Math.round(display))}</span>;
}

type ProgressRingProps = {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

export function ProgressRing({
  value,
  max = 100,
  size = 36,
  strokeWidth = 3,
  className,
}: ProgressRingProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <svg width={size} height={size} className={cn("shrink-0 -rotate-90", className)} aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(139,92,246,0.12)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={platformTokens.primary.purple}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="platform-progress-ring"
      />
    </svg>
  );
}

export function computeTrendPercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}
