"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const InstallPrompt = dynamic(
  () =>
    import("@/components/pwa/install-prompt").then((m) => ({
      default: m.InstallPrompt,
    })),
  { ssr: false }
);

const PwaServiceWorkerRegistrar = dynamic(
  () =>
    import("@/components/pwa/pwa-service-worker-registrar").then((m) => ({
      default: m.PwaServiceWorkerRegistrar,
    })),
  { ssr: false }
);

/**
 * Admin PWA install capture — separate from the customer shell in the root layout.
 */
export function AdminPwaShell() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const enable = () => setReady(true);

    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(enable, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }

    const timer = setTimeout(enable, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <InstallPrompt variant="admin" />
      {ready ? <PwaServiceWorkerRegistrar scope="/admin" /> : null}
    </>
  );
}
