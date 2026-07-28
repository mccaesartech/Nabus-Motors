"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Logo } from "@/components/shared/logo";
import { BackNav } from "@/components/shared/back-nav";
import { clearPlatformHistoryGuard } from "@/lib/platform/history-guard";
import { ROUTES } from "@/lib/routes";

type AdminAuthShellProps = {
  children: React.ReactNode;
};

export function AdminAuthShell({ children }: AdminAuthShellProps) {
  useEffect(() => {
    // Login / invite are intentional exits from the workspace Back stack.
    clearPlatformHistoryGuard();
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--platform-bg)]">
      <header className="sticky top-0 z-10 shrink-0 border-b border-[var(--platform-border)] bg-[var(--platform-bg)]/95 backdrop-blur-sm">
        <Container className="flex max-w-md items-center justify-between gap-3 py-3 sm:py-4">
          <BackNav href={ROUTES.corporate.home} label="Back" variant="platform" compact />
          <Link href={ROUTES.corporate.home} aria-label="True Goshen Company Limited home" className="shrink-0">
            <Logo variant="purple" height={44} href={false} />
          </Link>
          <span className="w-[5.5rem] shrink-0" aria-hidden />
        </Container>
      </header>
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6 sm:items-center sm:justify-center sm:py-10">
        <Container className="w-full max-w-md sm:mx-auto">{children}</Container>
      </div>
    </div>
  );
}
