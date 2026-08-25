"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { PlatformAccountMenu } from "@/components/platform/platform-account-menu";
import { type PlatformRole } from "@/lib/platform/permissions";
import {
  resolveDashboardPersona,
  type DashboardPersona,
} from "@/lib/platform/dashboard-role-kpis";
import type { PlatformPermission } from "@/lib/platform/permissions";

const PERSONA_LABELS: Record<DashboardPersona, string> = {
  ceo: "Executive overview",
  sales: "Sales focus",
  inventory: "Inventory focus",
  operations: "Operations focus",
  freight: "Freight focus",
  customer_support: "Support focus",
};

type WelcomeHeaderProps = {
  userName: string;
  role: PlatformRole;
  permissions: Record<PlatformPermission, boolean>;
  businessSummary?: string;
};

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function WelcomeHeader({
  userName,
  role,
  permissions,
  businessSummary,
}: WelcomeHeaderProps) {
  // Locale/timezone-sensitive strings must wait for the client to avoid SSR mismatch.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  const greeting = now ? greetingForHour(now.getHours()) : "Hello";
  const persona = resolveDashboardPersona(role, permissions);
  const dateLabel = now
    ? now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <header className="platform-card min-w-0 max-w-full overflow-x-clip rounded-2xl p-4 sm:p-8">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--platform-text-secondary)]">
            {PERSONA_LABELS[persona]}
          </p>
          <h1 className="break-words text-2xl font-semibold tracking-tight text-[var(--platform-text)] sm:text-3xl">
            {greeting}, {userName.split(" ")[0]}
          </h1>
          <p className="max-w-2xl break-words text-sm leading-relaxed text-[var(--platform-text-secondary)]">
            {businessSummary ??
              "Here is what needs your attention today and how the business is performing."}
          </p>
        </div>
        <div className="flex w-full min-w-0 shrink-0 flex-col items-start gap-2 sm:w-auto sm:items-end">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-[var(--platform-text-secondary)]">
            <CalendarDays className="size-4 shrink-0 text-[var(--platform-accent)]" aria-hidden />
            {now ? (
              <time dateTime={now.toISOString()} className="min-w-0 break-words">
                {dateLabel}
              </time>
            ) : (
              <span className="min-w-0 break-words" aria-hidden>
                &nbsp;
              </span>
            )}
          </div>
          <PlatformAccountMenu
            userName={userName}
            userRole={role}
            variant="dashboard"
          />
        </div>
      </div>
    </header>
  );
}
