"use client";

import { usePathname } from "next/navigation";
import { FullPageLink } from "@/components/shared/full-page-link";
import { Container } from "@/components/shared/container";
import { CORPORATE_HOME, ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const FREIGHT_LINKS = [
  { href: ROUTES.corporate.freight, label: "Freight Services" },
  { href: ROUTES.corporate.freightTracking, label: "Track Shipment" },
  { href: ROUTES.corporate.shippingConsultation, label: "Shipping Consultation" },
] as const;

function isFreightLinkActive(pathname: string, href: string): boolean {
  if (href === ROUTES.corporate.freight) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function FreightSubNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Freight division"
      className="border-b border-border/60 bg-muted/20"
    >
      <Container className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
        <div className="flex flex-wrap items-center gap-1 sm:gap-0.5">
          {FREIGHT_LINKS.map((link, index) => {
            const active = isFreightLinkActive(pathname, link.href);
            return (
              <span key={link.href} className="inline-flex items-center">
                {index > 0 && (
                  <span
                    className="mx-1.5 hidden text-muted-foreground/50 sm:inline"
                    aria-hidden
                  >
                    |
                  </span>
                )}
                <FullPageLink
                  href={link.href}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-brand-purple/10 text-brand-purple"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </FullPageLink>
              </span>
            );
          })}
        </div>
        <FullPageLink
          href={CORPORATE_HOME}
          className="shrink-0 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Company Home
        </FullPageLink>
      </Container>
    </nav>
  );
}
