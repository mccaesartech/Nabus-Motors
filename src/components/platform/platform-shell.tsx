"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { PlatformSidebar } from "./sidebar";
import { PlatformTopbar } from "./topbar";
import { PlatformDbBanner } from "./platform-db-banner";
import { AdminNotificationsProvider } from "@/context/admin-notifications-context";
import { PlatformCurrencyProvider } from "@/context/platform-currency-context";
import { PwaInstallToastHost } from "@/components/pwa/pwa-install-toast-host";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
import { initDeferredInstallPromptCapture } from "@/lib/pwa/install-utils";
import { cn } from "@/lib/utils";
import type { PlatformPermission, PlatformRole } from "@/lib/platform/permissions";

type SessionPermissions = Record<PlatformPermission, boolean>;

type PlatformSession = {
  name: string;
  email: string;
  role: PlatformRole;
  permissions: SessionPermissions;
};

const PlatformSessionContext = createContext<PlatformSession | null>(null);

export function usePlatformSession() {
  return useContext(PlatformSessionContext);
}

type PlatformShellProps = {
  children: React.ReactNode;
  userName: string;
  userRole: PlatformRole;
  userEmail: string;
  permissions: SessionPermissions;
  authType: "owner" | "user";
  authUserId?: string;
};

export function PlatformShell({
  children,
  userName,
  userRole,
  userEmail,
  permissions,
  authType,
  authUserId,
}: PlatformShellProps) {
  const pathname = usePathname() ?? "";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useLockBodyScroll(mobileOpen);

  useEffect(() => {
    initDeferredInstallPromptCapture();
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setCollapsed(false);
  }, [pathname]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const syncDesktop = () => {
      if (media.matches) {
        setMobileOpen(false);
      } else {
        // Phones use a full overlay drawer; a persistent 72px rail leaves charts too narrow.
        setCollapsed(false);
      }
    };
    syncDesktop();
    media.addEventListener("change", syncDesktop);
    return () => media.removeEventListener("change", syncDesktop);
  }, []);

  function handleMenuClick() {
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;

    if (isDesktop) {
      setCollapsed(false);
      return;
    }

    setMobileOpen((open) => !open);
    setCollapsed(false);
  }

  function handleMobileClose() {
    setMobileOpen(false);
    setCollapsed(false);
  }

  function handleExpand() {
    setCollapsed(false);
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    if (!isDesktop) {
      setMobileOpen(true);
    }
  }

  function handleMobileRailClose() {
    setCollapsed(false);
  }

  const resolved: PlatformSession = useMemo(
    () => ({
      name: userName,
      email: userEmail,
      role: userRole,
      permissions,
    }),
    [userName, userEmail, userRole, permissions]
  );

  // Stable identity — a fresh object here re-triggers the notifications
  // provider's session effect on every shell re-render (nav, sidebar toggles).
  const realtimeSession = useMemo(
    () => ({ type: authType, userId: authUserId }),
    [authType, authUserId]
  );

  const showMobileIconRail = collapsed && !mobileOpen;

  return (
    <PlatformCurrencyProvider>
    <AdminNotificationsProvider realtimeSession={realtimeSession}>
    <PlatformSessionContext.Provider value={resolved}>
      <div
        className={cn(
          // overflow-x-clip (not overflow-hidden) so portrait content can't trap zoom/scroll;
          // avoid 100dvw which often causes 1px sideways overflow on mobile browsers.
          "platform-theme grid h-dvh w-full max-w-full overflow-x-clip overflow-y-hidden max-lg:grid-cols-1",
          collapsed
            ? "lg:grid-cols-[4.5rem_minmax(0,1fr)]"
            : "lg:grid-cols-[16rem_minmax(0,1fr)]"
        )}
      >
        <PlatformSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          mobileOpen={mobileOpen}
          onMobileClose={handleMobileClose}
          onExpand={handleExpand}
          onMobileRailClose={handleMobileRailClose}
          permissions={resolved.permissions}
        />
        <div
          className={cn(
            "relative z-0 flex min-h-0 min-w-0 max-w-full flex-col overflow-x-clip",
            showMobileIconRail && "max-lg:pl-[4.5rem]"
          )}
        >
          <PlatformTopbar
            sidebarCollapsed={collapsed}
            mobileNavOpen={mobileOpen}
            onMenuClick={handleMenuClick}
            userName={resolved.name}
            userRole={resolved.role}
          />
          <main
            id="main-content"
            className="platform-main platform-scrollbar min-h-0 min-w-0 max-w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain p-3 sm:p-5 lg:p-8"
            onMouseDown={(event) => {
              const target = event.target as HTMLElement;
              if (
                target.closest(
                  "input, textarea, select, [contenteditable='true'], button, a, label"
                )
              ) {
                return;
              }
              const active = document.activeElement;
              if (
                active instanceof HTMLInputElement ||
                active instanceof HTMLTextAreaElement
              ) {
                active.blur();
              }
            }}
          >
            <PlatformDbBanner />
            {children}
          </main>
        </div>
      </div>
      <PwaInstallToastHost />
    </PlatformSessionContext.Provider>
    </AdminNotificationsProvider>
    </PlatformCurrencyProvider>
  );
}
