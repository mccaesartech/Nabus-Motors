"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CustomerNotification } from "@/lib/customer/notification-types";
import { useCustomerAuth } from "@/context/customer-auth-context";
import { useAfterIdle } from "@/hooks/use-after-idle";
import {
  countUnreadAdminNotifications,
  mergeLoadedNotificationReadState,
} from "@/lib/platform/notification-read-state";

type MarkReadMatchingOptions = {
  link?: string;
  type?: string;
};

type CustomerNotificationsContextValue = {
  notifications: CustomerNotification[];
  unreadCount: number;
  loading: boolean;
  load: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markReadMatching: (options: MarkReadMatchingOptions) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const CustomerNotificationsContext =
  createContext<CustomerNotificationsContextValue | null>(null);

const POLL_MS = 60_000;

function matchesCriteria(
  notification: CustomerNotification,
  options: MarkReadMatchingOptions
): boolean {
  if (notification.readAt) return false;
  if (options.link && notification.link !== options.link) return false;
  if (options.type && notification.type !== options.type) return false;
  return true;
}

export function CustomerNotificationsProvider({ children }: { children: ReactNode }) {
  const { user, getAccessToken, loading: authLoading } = useCustomerAuth();
  const idleReady = useAfterIdle(2000);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const token = await getAccessToken();
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch("/api/customer/notifications?limit=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      const incoming = (json.notifications ?? []) as CustomerNotification[];
      setNotifications((previous) => {
        const merged = mergeLoadedNotificationReadState(previous, incoming);
        setUnreadCount(countUnreadAdminNotifications(merged));
        return merged;
      });
    } finally {
      setLoading(false);
    }
  }, [user, getAccessToken]);

  useEffect(() => {
    if (authLoading || !idleReady) return;
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    void load();
    const interval = window.setInterval(() => void load(), POLL_MS);

    const onFocus = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [authLoading, idleReady, user, load]);

  const patchNotifications = useCallback(
    async (body: Record<string, unknown>) => {
      const token = await getAccessToken();
      if (!token) return false;

      const res = await fetch("/api/customer/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      return res.ok;
    },
    [getAccessToken]
  );

  const markRead = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      setNotifications((prev) => {
        const wasUnread = prev.some((n) => n.id === id && !n.readAt);
        if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
        return prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: now } : n));
      });

      const ok = await patchNotifications({ id });
      if (!ok) void load();
    },
    [load, patchNotifications]
  );

  const markReadMatching = useCallback(
    async (options: MarkReadMatchingOptions) => {
      if (!options.link && !options.type) return;

      const now = new Date().toISOString();
      let marked = 0;
      setNotifications((prev) =>
        prev.map((n) => {
          if (!matchesCriteria(n, options)) return n;
          marked += 1;
          return { ...n, readAt: now };
        })
      );
      if (marked > 0) setUnreadCount((c) => Math.max(0, c - marked));

      const ok = await patchNotifications(options);
      if (!ok) void load();
    },
    [load, patchNotifications]
  );

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    setUnreadCount(0);

    const ok = await patchNotifications({ all: true });
    if (!ok) void load();
  }, [load, patchNotifications]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      load,
      markRead,
      markReadMatching,
      markAllRead,
    }),
    [notifications, unreadCount, loading, load, markRead, markReadMatching, markAllRead]
  );

  return (
    <CustomerNotificationsContext.Provider value={value}>
      {children}
    </CustomerNotificationsContext.Provider>
  );
}

export function useCustomerNotifications() {
  const ctx = useContext(CustomerNotificationsContext);
  if (!ctx) {
    throw new Error("useCustomerNotifications must be used within CustomerNotificationsProvider");
  }
  return ctx;
}

/** Safe hook for header chrome — returns zero count when provider is absent. */
export function useCustomerNotificationCount(): number {
  const ctx = useContext(CustomerNotificationsContext);
  return ctx?.unreadCount ?? 0;
}
