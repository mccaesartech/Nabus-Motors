"use client";

import { useEffect } from "react";
import {
  checkBuildVersion,
  clearReloadAttempts,
  isChunkLoadFailure,
  patchFetchForStaleCache,
  reloadForStaleCache,
  stripCacheBustParam,
  unregisterStaleServiceWorkers,
} from "@/lib/cache-recovery";

/** Auto-recover when deploys leave cached HTML pointing at removed JS chunks. */
export function ChunkReloadHandler() {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const reloadedForSw = await unregisterStaleServiceWorkers();
      if (cancelled || reloadedForSw) return;
      checkBuildVersion();
    })();

    const unpatchFetch = patchFetchForStaleCache();

    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadFailure(event.reason)) {
        event.preventDefault();
        reloadForStaleCache();
      }
    };

    const onError = (event: ErrorEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLScriptElement &&
        target.src.includes("/_next/static/")
      ) {
        event.preventDefault();
        reloadForStaleCache();
        return;
      }
      if (
        isChunkLoadFailure(event.message) ||
        isChunkLoadFailure(event.error)
      ) {
        event.preventDefault();
        reloadForStaleCache();
      }
    };

    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError, true);

    const successTimer = window.setTimeout(() => {
      clearReloadAttempts();
      stripCacheBustParam();
    }, 3000);

    return () => {
      cancelled = true;
      unpatchFetch();
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError, true);
      window.clearTimeout(successTimer);
    };
  }, []);

  return null;
}
