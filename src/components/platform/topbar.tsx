"use client";

import { usePathname } from "next/navigation";
import {
  ExternalLink,
  LogOut,
  Menu,
  Search,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminLoginPath } from "@/lib/admin/paths";
import { ROLE_LABELS, type PlatformRole } from "@/lib/platform/permissions";
import { platformPageTitle } from "@/lib/platform/page-title";
import { platformPath } from "@/lib/platform/paths";
import { GlobalSearch } from "@/components/platform/global-search";
import { NotificationCenter } from "@/components/platform/notification-center";
import { PlatformCurrencySelector } from "@/components/platform/platform-currency-selector";
import { BackNav } from "@/components/shared/back-nav";
import { Logo } from "@/components/shared/logo";
import { platformMobileBackTarget } from "@/lib/platform/mobile-back";

type PlatformTopbarProps = {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  onMenuClick: () => void;
  userName: string;
  userRole: PlatformRole;
};

export function PlatformTopbar({
  sidebarCollapsed,
  mobileNavOpen,
  onMenuClick,
  userName,
  userRole,
}: PlatformTopbarProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const pageTitle = platformPageTitle(pathname);
  const mobileBack = platformMobileBackTarget(pathname);
  const showMobileTopbarLogo = !mobileNavOpen && !sidebarCollapsed;

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push(adminLoginPath());
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-[var(--platform-border)] bg-[var(--platform-bg)] px-3 sm:gap-3 sm:px-4 lg:px-6">
      {showMobileTopbarLogo && (
        <Link
          href="/platform/dashboard"
          className="flex shrink-0 items-center lg:hidden"
          aria-label="True Goshen Admin"
        >
          <Logo
            variant="purple"
            height={28}
            href={false}
            priority
            className="h-7 w-auto max-w-[7.5rem]"
          />
        </Link>
      )}

      <button
        type="button"
        onClick={onMenuClick}
        className={`platform-btn-ghost size-10 shrink-0 p-0 text-[var(--platform-text)] ${sidebarCollapsed ? "inline-flex" : "max-lg:inline-flex lg:hidden"}`}
        aria-label={
          mobileNavOpen
            ? "Close navigation"
            : sidebarCollapsed
              ? "Expand sidebar"
              : "Open navigation"
        }
        aria-expanded={mobileNavOpen}
        aria-controls="platform-sidebar"
      >
        {mobileNavOpen ? (
          <X className="size-5 shrink-0" strokeWidth={2} aria-hidden />
        ) : (
          <Menu className="size-5 shrink-0" strokeWidth={2} aria-hidden />
        )}
      </button>

      {mobileBack && (
        <BackNav
          href={mobileBack.href}
          label={mobileBack.label}
          variant="platform"
          compact
          className="shrink-0 lg:hidden"
        />
      )}

      <div className="min-w-0 flex-1 lg:hidden">
        <p className="truncate text-sm font-semibold text-[var(--platform-text)]">
          {pageTitle}
        </p>
      </div>

      <div className="hidden min-w-0 flex-1 lg:block">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--platform-text-secondary)]">
          Platform / {pageTitle}
        </p>
        <p className="truncate text-sm font-semibold text-[var(--platform-text)]">
          {pageTitle}
        </p>
      </div>

      <GlobalSearch className="relative z-20 hidden min-w-0 flex-1 lg:ml-auto lg:block lg:max-w-md" />

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <Link
          href={platformPath("search")}
          className="platform-btn-ghost inline-flex size-10 p-0 text-[var(--platform-text)] lg:hidden"
          aria-label="Search"
        >
          <Search className="size-5 shrink-0" strokeWidth={2} aria-hidden />
        </Link>

        <PlatformCurrencySelector />

        <NotificationCenter />

        <Link
          href="/"
          target="_blank"
          className="platform-btn-ghost hidden sm:inline-flex"
        >
          <ExternalLink className="size-4" />
          <span className="hidden md:inline">Public site</span>
        </Link>

        <div className="relative group">
          <button
            type="button"
            className="flex items-center gap-2 rounded-md border border-[var(--platform-border)] bg-[var(--platform-card)] px-2 py-1.5 text-sm transition-colors hover:border-[#c4b5fd]"
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-[rgba(139,92,246,0.12)] text-[var(--platform-accent)]">
              <User className="size-4" />
            </span>
            <span className="hidden text-left md:block">
              <span className="block text-[var(--platform-text)]">{userName}</span>
              <span className="block text-[10px] text-[var(--platform-text-secondary)]">
                {ROLE_LABELS[userRole]}
              </span>
            </span>
          </button>
          <div className="invisible absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-[var(--platform-border)] bg-[var(--platform-card)] py-1 opacity-0 shadow-lg transition-all group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--platform-text-secondary)] hover:bg-[rgba(76,29,149,0.06)] hover:text-[var(--platform-text)]"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
