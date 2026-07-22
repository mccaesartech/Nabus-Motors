"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const VehiclePreferencesSync = dynamic(
  () =>
    import("@/components/recommendations/vehicle-preferences-sync").then((m) => ({
      default: m.VehiclePreferencesSync,
    })),
  { ssr: false }
);

export function DeferredVehiclePreferencesSync() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const enable = () => setReady(true);

    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(enable, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }

    const timer = setTimeout(enable, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) return null;
  return <VehiclePreferencesSync />;
}
