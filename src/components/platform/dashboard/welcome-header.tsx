"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { PlatformAccountMenu } from "@/components/platform/platform-account-menu";
import { type PlatformRole } from "@/lib/platform/permissions";
type WelcomeHeaderProps = {
  userName: string;
  role: PlatformRole;
};

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function WelcomeHeader({ userName, role }: WelcomeHeaderProps) {
  // Locale/timezone-sensitive strings must wait for the client to avoid SSR mismatch.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  const greeting = now ? greetingForHour(now.getHours()) : "Hello";
  const dateLabel = now
    ? now.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <header className="min-w-0 max-w-full overflow-x-clip">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="break-words text-2xl font-bold tracking-tight text-[var(--platform-text)] sm:text-[1.75rem]">
            {greeting}, {userName.split(" ")[0]}
          </h1>
          <p className="max-w-2xl break-words text-sm leading-relaxed text-[var(--platform-text-secondary)]">
            Here&apos;s what&apos;s happening at Nabus Motors today.
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
