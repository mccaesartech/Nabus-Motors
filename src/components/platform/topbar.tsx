"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  Download,
  Menu,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  canInstallPlatformApp,
  hasPermission,
  type PlatformRole,
} from "@/lib/platform/permissions";
import { platformPageTitle } from "@/lib/platform/page-title";
import { platformPath } from "@/lib/platform/paths";
import { PlatformCurrencySelector } from "@/components/platform/platform-currency-selector";
import { BackNav } from "@/components/shared/back-nav";
import { Logo } from "@/components/shared/logo";
import { PlatformAccountMenu } from "@/components/platform/platform-account-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { platformMobileBackTarget } from "@/lib/platform/mobile-back";
import {
  isStandaloneForVariant,
  queryInstalledPwaVariants,
  requestPwaInstallPrompt,
  triggerPwaInstall,
} from "@/lib/pwa/install-utils";

const GlobalSearch = dynamic(
  () =>
    import("@/components/platform/global-search").then((m) => m.GlobalSearch),
  {
    ssr: false,
    loading: () => (
      <div
        className="hidden h-10 min-w-0 flex-1 rounded-md border border-[var(--platform-border)] bg-[var(--platform-card)] lg:ml-auto lg:block lg:max-w-md"
        aria-hidden
      />
    ),
  }
);

const NotificationCenter = dynamic(
  () =>
    import("@/components/platform/notification-center").then(
      (m) => m.NotificationCenter
    ),
  { ssr: false, loading: () => <span className="inline-flex size-10" aria-hidden /> }
);

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
  const pathname = usePathname() ?? "";
  const pageTitle = platformPageTitle(pathname);
  const mobileBack = platformMobileBackTarget(pathname);
  const showMobileTopbarLogo = !mobileNavOpen && !sidebarCollapsed;
  const showInstallApp = canInstallPlatformApp(userRole);
  const showProminentInstallApp =
    showInstallApp && !hasPermission(userRole, "settings");
  const [appInstalled, setAppInstalled] = useState(false);

  useEffect(() => {
    let active = true;

    async function syncInstallState() {
      if (isStandaloneForVariant("admin")) {
        setAppInstalled(true);
        return;
      }

      const installed = await queryInstalledPwaVariants();
      if (active) setAppInstalled(installed.admin);
    }

    void syncInstallState();
    return () => {
      active = false;
    };
  }, []);

  async function installApp() {
    if (appInstalled) return;

    const result = await triggerPwaInstall("admin");
    if (result === "installed") {
      setAppInstalled(true);
    } else if (result === "unavailable") {
      requestPwaInstallPrompt("admin");
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 min-w-0 max-w-full shrink-0 items-center gap-1.5 overflow-x-hidden border-b border-[var(--platform-border)] bg-[var(--platform-bg)] px-2 sm:gap-3 sm:px-4 lg:px-6">
      {showMobileTopbarLogo && (
        <Link
          href="/platform/dashboard"
          className="hidden shrink-0 items-center sm:flex lg:hidden"
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

      <div className="flex min-w-0 shrink-0 items-center gap-0.5 sm:gap-1">
        <Link
          href={platformPath("search")}
          className="platform-btn-ghost inline-flex size-10 p-0 text-[var(--platform-text)] lg:hidden"
          aria-label="Search"
        >
          <Search className="size-5 shrink-0" strokeWidth={2} aria-hidden />
        </Link>

        <div className="hidden sm:block">
          <PlatformCurrencySelector />
        </div>

        <NotificationCenter />

        <Link
          href="/"
          target="_blank"
          className="platform-btn-ghost hidden sm:inline-flex"
        >
          <ExternalLink className="size-4" />
          <span className="hidden md:inline">Public site</span>
        </Link>

        {showProminentInstallApp ? (
          <button
            type="button"
            onClick={() => void installApp()}
            disabled={appInstalled}
            className="platform-btn-ghost min-h-11 shrink-0 px-2 text-[var(--platform-text)] disabled:cursor-default disabled:opacity-70"
            aria-label={appInstalled ? "Platform web app installed" : "Install platform web app"}
          >
            <Download className="size-4" aria-hidden />
            <span className="hidden sm:inline">
              {appInstalled ? "App installed" : "Install app"}
            </span>
          </button>
        ) : null}

        <PlatformAccountMenu
          userName={userName}
          userRole={userRole}
          className="shrink-0"
          menuActions={
            showInstallApp && !showProminentInstallApp ? (
              <DropdownMenuItem
                onClick={installApp}
                disabled={appInstalled}
                className="min-h-11 cursor-pointer gap-2 px-3 py-2 text-[var(--platform-text-secondary)] focus:bg-[rgba(76,29,149,0.06)] focus:text-[var(--platform-text)]"
              >
                <Download className="size-4" aria-hidden />
                {appInstalled ? "Web app installed" : "Install web app"}
              </DropdownMenuItem>
            ) : null
          }
        />
      </div>
    </header>
  );
}
