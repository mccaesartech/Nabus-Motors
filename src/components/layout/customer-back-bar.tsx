"use client";

import { usePathname } from "next/navigation";
import { BackNav } from "@/components/shared/back-nav";
import { Container } from "@/components/shared/container";
import { getCustomerBackNav } from "@/lib/customer-back-routes";

export function CustomerBackBar() {
  const pathname = usePathname() ?? "";
  const config = getCustomerBackNav(pathname);

  if (!config) return null;

  return (
    <nav
      aria-label="Page back"
      className="border-b border-border/40 bg-background"
    >
      <Container className="py-2.5">
        <BackNav
          href={config.fallbackHref}
          label={config.label}
          fallbackHref={config.fallbackHref}
          variant="public"
        />
      </Container>
    </nav>
  );
}
