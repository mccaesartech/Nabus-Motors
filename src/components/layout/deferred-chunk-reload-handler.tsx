"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const ChunkReloadHandlerImpl = dynamic(
  () =>
    import("@/components/layout/chunk-reload-handler").then((m) => ({
      default: m.ChunkReloadHandler,
    })),
  { ssr: false }
);

/** Defers cache-recovery listeners until after the main thread settles. */
export function DeferredChunkReloadHandler() {
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
  return <ChunkReloadHandlerImpl />;
}
