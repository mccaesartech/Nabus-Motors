"use client";

import { useEffect } from "react";
import {
  BUILD_RELOAD_KEY,
  getBuildIdFromDom,
} from "@/lib/cache-recovery";

type PwaServiceWorkerRegistrarProps = {
  /** SW scope — customer uses `/`, admin uses `/admin` for separate install identity. */
  scope?: string;
};

/**
 * Registers the Serwist service worker without pulling @serwist/turbopack/react
 * or patching history during the critical rendering path.
 *
 * On SW *updates* (skipWaiting + clientsClaim), reload once per build so pages
 * do not keep running against a newly claimed worker. Shares BUILD_RELOAD_KEY
 * with cache-recovery so deploy recovery does not double-reload.
 */
export function PwaServiceWorkerRegistrar({
  scope = "/",
}: PwaServiceWorkerRegistrarProps) {
  useEffect(() => {
    let cancelled = false;

    const register = async () => {
      if (cancelled || !("serviceWorker" in navigator)) return;

      try {
        const { Serwist } = await import("@serwist/window");
        if (cancelled) return;

        const serwist = new Serwist("/serwist/sw.js", {
          scope,
          type: "module",
        });

        serwist.addEventListener("controlling", (event) => {
          if (!event.isUpdate) return;

          const buildId = getBuildIdFromDom() || "unknown";
          try {
            if (sessionStorage.getItem(BUILD_RELOAD_KEY) === buildId) return;
            sessionStorage.setItem(BUILD_RELOAD_KEY, buildId);
          } catch {
            // Still allow a single update reload if storage is unavailable.
          }
          window.location.reload();
        });

        await serwist.register();
      } catch {
        /* SW optional — ignore registration failures */
      }
    };

    const run = () => void register();

    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 10000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }

    const timer = setTimeout(run, 6000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scope]);

  return null;
}
