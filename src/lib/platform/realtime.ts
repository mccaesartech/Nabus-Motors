"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { AdminNotification } from "@/lib/platform/types";
import type { TeamMessage } from "@/lib/platform/team-messages";

const POLL_FALLBACK_MS = 30_000;

type SessionIdentity = {
  type: "owner" | "user";
  userId?: string;
};

export function inboxChannelForSession(session: SessionIdentity): string | null {
  if (session.type === "owner") return "team-chat:inbox:owner";
  if (session.userId) return `team-chat:inbox:user:${session.userId}`;
  return null;
}

export function notificationChannelForSession(session: SessionIdentity): string | null {
  if (session.type === "owner") return "notifications:owner";
  if (session.userId) return `notifications:user:${session.userId}`;
  return null;
}

function mapRealtimeMessage(row: Record<string, unknown>, session: SessionIdentity): TeamMessage {
  const senderIsOwner = Boolean(row.sender_is_owner);
  const senderUserId = (row.sender_user_id as string | null) ?? null;
  const isMine =
    session.type === "owner"
      ? senderIsOwner
      : !senderIsOwner && senderUserId === session.userId;

  return {
    id: String(row.id),
    conversation_id: String(row.conversation_id),
    sender_user_id: senderUserId,
    sender_is_owner: senderIsOwner,
    sender_name: String(row.sender_name ?? ""),
    sender_email: String(row.sender_email ?? ""),
    body: String(row.body ?? ""),
    created_at: String(row.created_at ?? new Date().toISOString()),
    isMine,
  };
}

type UseTeamChatRealtimeOptions = {
  conversationId: string | null;
  session: SessionIdentity | null;
  onNewMessage: (message: TeamMessage) => void;
  onInboxUpdate: () => void;
  enabled?: boolean;
};

export function useTeamChatRealtime({
  conversationId,
  session,
  onNewMessage,
  onInboxUpdate,
  enabled = true,
}: UseTeamChatRealtimeOptions) {
  const onNewMessageRef = useRef(onNewMessage);
  const onInboxUpdateRef = useRef(onInboxUpdate);
  const realtimeActiveRef = useRef(false);

  onNewMessageRef.current = onNewMessage;
  onInboxUpdateRef.current = onInboxUpdate;

  useEffect(() => {
    if (!enabled || !supabase || !session) return;
    const client = supabase;

    const channels: RealtimeChannel[] = [];
    realtimeActiveRef.current = false;

    const inboxChannel = inboxChannelForSession(session);
    if (inboxChannel) {
      const inbox = client
        .channel(inboxChannel)
        .on("broadcast", { event: "inbox_update" }, () => {
          realtimeActiveRef.current = true;
          onInboxUpdateRef.current();
        })
        .subscribe();
      channels.push(inbox);
    }

    if (conversationId) {
      const thread = client
        .channel(`team-chat:${conversationId}`)
        .on("broadcast", { event: "new_message" }, ({ payload }) => {
          realtimeActiveRef.current = true;
          const message = (payload as { message?: Record<string, unknown> }).message;
          if (message) onNewMessageRef.current(mapRealtimeMessage(message, session));
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "platform_messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            realtimeActiveRef.current = true;
            if (payload.new) {
              onNewMessageRef.current(
                mapRealtimeMessage(payload.new as Record<string, unknown>, session)
              );
            }
          }
        )
        .subscribe();
      channels.push(thread);
    }

    const pollTimer = window.setInterval(() => {
      if (!realtimeActiveRef.current) {
        onInboxUpdateRef.current();
      }
    }, POLL_FALLBACK_MS);

    return () => {
      window.clearInterval(pollTimer);
      for (const channel of channels) {
        void client.removeChannel(channel);
      }
    };
  }, [conversationId, enabled, session?.type, session?.userId]);
}

type UseNotificationRealtimeOptions = {
  session: SessionIdentity | null;
  onNotification: (notification: AdminNotification) => void;
  onRefresh: () => void;
  enabled?: boolean;
};

export function useNotificationRealtime({
  session,
  onNotification,
  onRefresh,
  enabled = true,
}: UseNotificationRealtimeOptions) {
  const onNotificationRef = useRef(onNotification);
  const onRefreshRef = useRef(onRefresh);
  const realtimeActiveRef = useRef(false);

  onNotificationRef.current = onNotification;
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled || !supabase || !session) return;
    const client = supabase;

    const channelName = notificationChannelForSession(session);
    if (!channelName) return;

    realtimeActiveRef.current = false;

    const channel = client
      .channel(channelName)
      .on("broadcast", { event: "new_notification" }, ({ payload }) => {
        realtimeActiveRef.current = true;
        const notification = (payload as { notification?: AdminNotification }).notification;
        if (notification) onNotificationRef.current(notification);
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "admin_notifications",
        },
        () => {
          realtimeActiveRef.current = true;
          onRefreshRef.current();
        }
      )
      .subscribe();

    const pollTimer = window.setInterval(() => {
      if (!realtimeActiveRef.current) {
        onRefreshRef.current();
      }
    }, POLL_FALLBACK_MS);

    return () => {
      window.clearInterval(pollTimer);
      void client.removeChannel(channel);
    };
  }, [enabled, session?.type, session?.userId]);
}
