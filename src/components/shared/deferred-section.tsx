"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type DeferredSectionProps = {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  /** Called once when the section becomes visible — use to trigger lazy data fetches. */
  onVisible?: () => void;
};

/** Renders children once the section nears the viewport — defers images and heavy subtrees. */
export function DeferredSection({
  children,
  fallback = null,
  rootMargin = "240px",
  onVisible,
}: DeferredSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      onVisibleRef.current?.();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          onVisibleRef.current?.();
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return <div ref={ref}>{visible ? children : fallback}</div>;
}
