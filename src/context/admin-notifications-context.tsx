"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { countUnreadByNavHref } from "@/lib/platform/sidebar-notifications";
import {
  countUnreadAdminNotifications,
  mergeLoadedAdminNotifications,
} from "@/lib/platform/notification-read-state";
import { useNotificationRealtime } from "@/lib/platform/realtime";
import { useAfterIdle } from "@/hooks/use-after-idle";
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
  /** Optimistically remove notifications from local state (while trash API runs). */
  removeLocal: (ids: string[]) => void;
  /** Re-insert notifications after a failed trash API call. */
  restoreLocal: (items: AdminNotification[]) => void;
  /** Clear pending-removal suppression after trash API succeeds. */
  confirmRemoved: (ids: string[]) => void;
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

type AdminNotificationsProviderProps = {
  children: ReactNode;
  /** Server-resolved session — avoids /api/admin/session waterfall on shell mount. */
  realtimeSession?: RealtimeSession | null;
};

export function AdminNotificationsProvider({
  children,
  realtimeSession = null,
}: AdminNotificationsProviderProps) {
  const idleReady = useAfterIdle(1500);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [session, setSession] = useState<RealtimeSession | null>(realtimeSession);
  /** IDs removed optimistically — keep them out of poll/realtime merges until confirm/restore. */
  const pendingRemovedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (realtimeSession) {
      setSession(realtimeSession);
    }
  }, [realtimeSession]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/notifications?limit=50");
    if (!res.ok) return;
    const json = await res.json();
    const incoming = (json.notifications ?? []) as AdminNotification[];
    setNotifications((previous) => {
      const merged = mergeLoadedAdminNotifications(previous, incoming);
      const pending = pendingRemovedIdsRef.current;
      const next =
        pending.size > 0 ? merged.filter((n) => !pending.has(n.id)) : merged;
      setUnreadCount(countUnreadAdminNotifications(next));
      return next;
    });
  }, []);

  useNotificationRealtime({
    session,
    onNotification: (notification) => {
      if (pendingRemovedIdsRef.current.has(notification.id)) return;
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notification.id)) return prev;
        return [notification, ...prev].slice(0, 50);
      });
      if (!notification.readAt) {
        setUnreadCount((count) => count + 1);
      }
    },
    onRefresh: load,
    enabled: Boolean(session) && idleReady,
  });

  useEffect(() => {
    if (!idleReady) return;
    void load();
    const interval = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(interval);
  }, [idleReady, load]);

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
      const res = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) void load();
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
        const res = await fetch("/api/admin/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options),
        });
        if (!res.ok) void load();
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
      const res = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) void load();
    } catch {
      void load();
    }
  }, [load]);

  const removeLocal = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    for (const id of idSet) pendingRemovedIdsRef.current.add(id);
    setNotifications((prev) => {
      const next = prev.filter((n) => !idSet.has(n.id));
      setUnreadCount(countUnreadAdminNotifications(next));
      return next;
    });
  }, []);

  const restoreLocal = useCallback((items: AdminNotification[]) => {
    if (items.length === 0) return;
    for (const item of items) pendingRemovedIdsRef.current.delete(item.id);
    setNotifications((prev) => {
      const existing = new Set(prev.map((n) => n.id));
      const toAdd = items.filter((n) => !existing.has(n.id));
      if (toAdd.length === 0) return prev;
      const next = [...toAdd, ...prev].slice(0, 50);
      setUnreadCount(countUnreadAdminNotifications(next));
      return next;
    });
  }, []);

  const confirmRemoved = useCallback((ids: string[]) => {
    for (const id of ids) pendingRemovedIdsRef.current.delete(id);
  }, []);

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
      removeLocal,
      restoreLocal,
      confirmRemoved,
    }),
    [
      notifications,
      unreadCount,
      unreadByNavHref,
      load,
      markRead,
      markReadMatching,
      markAllRead,
      removeLocal,
      restoreLocal,
      confirmRemoved,
    ]
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
