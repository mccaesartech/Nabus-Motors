"use client";

import { useEffect, useState } from "react";

/** Becomes true after the browser is idle — defers non-critical fetches and polling. */
export function useAfterIdle(timeoutMs = 2500) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const enable = () => setReady(true);

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(enable, { timeout: timeoutMs });
      return () => window.cancelIdleCallback(id);
    }

    const timer = setTimeout(enable, Math.min(timeoutMs, 1500));
    return () => clearTimeout(timer);
  }, [timeoutMs]);

  return ready;
}
