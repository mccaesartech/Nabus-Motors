"use client";

import { usePathname } from "next/navigation";
import { FullPageLink } from "@/components/shared/full-page-link";
import { Container } from "@/components/shared/container";
import {
  CORPORATE_HOME,
  DIVISION_LABELS,
  getActiveDivision,
  isFreightDivisionPath,
  ROUTES,
} from "@/lib/routes";

export function DivisionContextBar() {
  const pathname = usePathname() ?? "";

  if (isFreightDivisionPath(pathname)) return null;

  const division = getActiveDivision(pathname);
  if (!division) return null;

  const label = DIVISION_LABELS[division];
  const showOnAutoHome = division === "auto" && pathname === ROUTES.auto.home;
  if (showOnAutoHome) return null;

  return (
    <nav
      aria-label="Division context"
      className="border-b border-border/50 bg-background"
    >
      <Container className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-xs text-muted-foreground">
        <FullPageLink
          href={CORPORATE_HOME}
          className="font-medium transition-colors hover:text-foreground"
        >
          Company Home
        </FullPageLink>
        <span aria-hidden className="text-border">
          /
        </span>
        <span className="font-medium text-foreground">{label}</span>
      </Container>
    </nav>
  );
}
