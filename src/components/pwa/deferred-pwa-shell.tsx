"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ConditionalPwaShell } from "@/components/pwa/conditional-pwa-shell";
import { isCustomerPublicPath } from "@/lib/pwa/routes";

/**
 * Loads customer PWA install UI and service worker after idle on public routes only.
 */
export function DeferredPwaShell() {
  const pathname = usePathname() ?? "";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isCustomerPublicPath(pathname)) {
      setReady(false);
      return;
    }

    const enable = () => setReady(true);

    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(enable, { timeout: 8000 });
      return () => window.cancelIdleCallback(id);
    }

    const timer = setTimeout(enable, 5000);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!ready || !isCustomerPublicPath(pathname)) return null;

  return <ConditionalPwaShell />;
}
