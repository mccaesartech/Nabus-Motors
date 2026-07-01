"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PlatformSidebar } from "./sidebar";
import { PlatformTopbar } from "./topbar";
import { PlatformDbBanner } from "./platform-db-banner";
import { AdminNotificationsProvider } from "@/context/admin-notifications-context";
import { PlatformCurrencyProvider } from "@/context/platform-currency-context";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";
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
};

export function PlatformShell({
  children,
  userName,
  userRole,
  userEmail,
}: PlatformShellProps) {
  const pathname = usePathname() ?? "";
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [session, setSession] = useState<PlatformSession | null>(null);

  useLockBodyScroll(mobileOpen);

  useEffect(() => {
    setMobileOpen(false);
    setCollapsed(false);
  }, [pathname]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const syncDesktop = () => {
      if (media.matches) {
        setMobileOpen(false);
      }
    };
    syncDesktop();
    media.addEventListener("change", syncDesktop);
    return () => media.removeEventListener("change", syncDesktop);
  }, []);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.ok) {
          setSession({
            name: json.user.name,
            email: json.user.email,
            role: json.user.role,
            permissions: json.permissions,
          });
        }
      })
      .catch(() => undefined);
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
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    setMobileOpen(false);
    if (!isDesktop) {
      setCollapsed(true);
    }
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

  const resolved: PlatformSession = session ?? {
    name: userName,
    email: userEmail,
    role: userRole,
    permissions: {
      dashboard: true,
      inventory: true,
      inventory_edit: userRole !== "staff",
      inventory_approve: userRole === "owner" || userRole === "super_admin",
      customers: true,
      sales: true,
      finance: userRole === "owner" || userRole === "super_admin",
      leads: true,
      freight: true,
      parts: userRole !== "staff",
      messages: true,
      emails: true,
      team_messages: true,
      documents: true,
      reports: userRole === "owner" || userRole === "super_admin",
      users: userRole === "owner" || userRole === "super_admin",
      settings: userRole === "owner" || userRole === "super_admin",
      site_content: userRole === "owner" || userRole === "super_admin" || userRole === "manager",
      activity: userRole === "owner" || userRole === "super_admin",
      trash: userRole === "owner" || userRole === "super_admin" || userRole === "manager",
    },
  };

  const showMobileIconRail = collapsed && !mobileOpen;

  return (
    <PlatformCurrencyProvider>
    <AdminNotificationsProvider>
    <PlatformSessionContext.Provider value={resolved}>
      <div
        className={cn(
          "platform-theme grid h-dvh overflow-hidden max-lg:grid-cols-1",
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
            "relative z-0 flex min-h-0 min-w-0 flex-col",
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
          <main className="platform-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-auto p-4 lg:p-6">
            <PlatformDbBanner />
            {children}
          </main>
        </div>
      </div>
    </PlatformSessionContext.Provider>
    </AdminNotificationsProvider>
    </PlatformCurrencyProvider>
  );
}
