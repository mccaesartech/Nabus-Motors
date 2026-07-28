"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  armPlatformHistoryGuard,
  rememberPlatformHistoryPath,
} from "@/lib/platform/history-guard";
import { isAdminPlatformPath } from "@/lib/pwa/routes";

/**
 * Arms Back-button hygiene while the authenticated platform shell is mounted.
 * Accidental public landings are restored by PlatformPublicHistoryBounce.
 */
export function PlatformHistoryGuard() {
  const pathname = usePathname() ?? "";

  useEffect(() => {
    if (!isAdminPlatformPath(pathname)) return;
    armPlatformHistoryGuard(pathname);
  }, [pathname]);

  useEffect(() => {
    if (!isAdminPlatformPath(pathname)) return;
    rememberPlatformHistoryPath(pathname);
  }, [pathname]);

  return null;
}
