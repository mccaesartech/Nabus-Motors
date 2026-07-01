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
import { countUnreadByNavHref } from "@/lib/platform/sidebar-notifications";
import { useNotificationRealtime } from "@/lib/platform/realtime";
import type { AdminNotification } from "@/lib/platform/types";

type RealtimeSession = {
  type: "owner" | "user";
  userId?: string;
};

type MarkReadMatchingOptions = {
  link?: string;
  type?: string;
};

type AdminNotificationsContextValue = {
  notifications: AdminNotification[];
  unreadCount: number;
  unreadByNavHref: Record<string, number>;
  load: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markReadMatching: (options: MarkReadMatchingOptions) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const AdminNotificationsContext = createContext<AdminNotificationsContextValue | null>(null);

const POLL_MS = 60_000;

function matchesCriteria(
  notification: AdminNotification,
  options: MarkReadMatchingOptions
): boolean {
  if (notification.readAt) return false;
  if (options.link && notification.link !== options.link) return false;
  if (options.type && notification.type !== options.type) return false;
  return true;
}

export function AdminNotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [session, setSession] = useState<RealtimeSession | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/notifications?limit=50");
    if (!res.ok) return;
    const json = await res.json();
    setNotifications(json.notifications ?? []);
    setUnreadCount(json.unreadCount ?? 0);
  }, []);

  useEffect(() => {
    void fetch("/api/admin/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!json?.user) return;
        setSession({
          type: json.user.type,
          userId: json.user.userId ?? undefined,
        });
      });
  }, []);

  useNotificationRealtime({
    session,
    onNotification: (notification) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notification.id)) return prev;
        return [notification, ...prev].slice(0, 50);
      });
      if (!notification.readAt) {
        setUnreadCount((count) => count + 1);
      }
    },
    onRefresh: load,
    enabled: Boolean(session),
  });

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(interval);
  }, [load]);

  const markRead = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    setNotifications((prev) => {
      const wasUnread = prev.some((n) => n.id === id && !n.readAt);
      if (wasUnread) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      return prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: now } : n));
    });

    try {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      void load();
    }
  }, [load]);

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
      if (marked > 0) {
        setUnreadCount((c) => Math.max(0, c - marked));
      }

      try {
        await fetch("/api/admin/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options),
        });
      } catch {
        void load();
      }
    },
    [load]
  );

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    setUnreadCount(0);

    try {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      void load();
    }
  }, [load]);

  const unreadByNavHref = useMemo(
    () => countUnreadByNavHref(notifications),
    [notifications]
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      unreadByNavHref,
      load,
      markRead,
      markReadMatching,
      markAllRead,
    }),
    [notifications, unreadCount, unreadByNavHref, load, markRead, markReadMatching, markAllRead]
  );

  return (
    <AdminNotificationsContext.Provider value={value}>
      {children}
    </AdminNotificationsContext.Provider>
  );
}

export function useAdminNotifications() {
  const ctx = useContext(AdminNotificationsContext);
  if (!ctx) {
    throw new Error("useAdminNotifications must be used within AdminNotificationsProvider");
  }
  return ctx;
}
