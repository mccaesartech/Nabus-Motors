"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const ANIMATION_DURATION_MS = 1200;

type ParsedStatValue =
  | { kind: "static"; text: string }
  | { kind: "animated"; target: number; suffix: string };

function parseCorporateStatValue(value: string): ParsedStatValue {
  const match = value.trim().match(/^(\d+)(\+|%)?$/);
  if (match) {
    return {
      kind: "animated",
      target: Number.parseInt(match[1], 10),
      suffix: match[2] ?? "",
    };
  }
  return { kind: "static", text: value.trim() };
}

type CorporateStatValueProps = {
  value: string;
  className?: string;
};

export function CorporateStatValue({ value, className }: CorporateStatValueProps) {
  const parsed = useMemo(() => parseCorporateStatValue(value), [value]);
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (parsed.kind === "static") return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [parsed.kind]);

  useEffect(() => {
    if (parsed.kind === "static" || !visible) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setDisplay(parsed.target);
      return;
    }

    const target = parsed.target;
    const start = performance.now();

    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / ANIMATION_DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(target * eased));
      if (t < 1) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [visible, parsed]);

  if (parsed.kind === "static") {
    return <span className={className}>{parsed.text}</span>;
  }

  return (
    <span ref={ref} className={className}>
      {display}
      {parsed.suffix}
    </span>
  );
}
