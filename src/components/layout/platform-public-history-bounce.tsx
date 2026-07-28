"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getPlatformHistoryBounceTarget } from "@/lib/platform/history-guard";

/**
 * Catches accidental browser Back from platform → public UI and restores
 * the last platform route (unless the user explicitly exited).
 */
export function PlatformPublicHistoryBounce() {
  const pathname = usePathname() ?? "";
  const router = useRouter();

  useEffect(() => {
    const bounce = () => {
      const target = getPlatformHistoryBounceTarget(
        typeof window !== "undefined" ? window.location.pathname : pathname
      );
      if (target) {
        router.replace(target);
      }
    };

    bounce();

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) bounce();
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [pathname, router]);

  return null;
}
