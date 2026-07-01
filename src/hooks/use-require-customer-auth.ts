"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCustomerAuth } from "@/context/customer-auth-context";

/** Redirects unauthenticated visitors to login with a return URL. */
export function useRequireCustomerAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useCustomerAuth();

  useEffect(() => {
    if (loading || user) return;
    const params = new URLSearchParams();
    if (pathname && pathname !== "/login") {
      params.set("redirect", pathname);
    }
    const query = params.toString();
    router.replace(query ? `/login?${query}` : "/login");
  }, [loading, user, router, pathname]);

  return { user, loading };
}
