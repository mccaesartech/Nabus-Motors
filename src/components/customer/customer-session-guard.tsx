"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCustomerAuth } from "@/context/customer-auth-context";
import { isSessionExpired } from "@/lib/customer/session-preference";

const EXPIRY_CHECK_MS = 60_000;

/** Signs customers out after the 24-hour absolute session window. */
export function CustomerSessionGuard() {
  const { user, signOut } = useCustomerAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "";

  useEffect(() => {
    if (!user) return;

    async function enforceExpiry() {
      if (!isSessionExpired()) return;
      await signOut();
      if (!pathname.startsWith("/login")) {
        router.replace("/login?expired=1");
      }
    }

    void enforceExpiry();

    const onFocus = () => void enforceExpiry();
    const interval = window.setInterval(() => void enforceExpiry(), EXPIRY_CHECK_MS);

    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, signOut, router, pathname]);

  return null;
}
