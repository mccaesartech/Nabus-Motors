"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { CustomerChatMessage } from "@/lib/customer/types";
import { customerFacingStaffSenderName } from "@/lib/customer/public-branding";

const POLL_FALLBACK_MS = 30_000;

function mapRealtimeMessage(
  row: Record<string, unknown>,
  viewer: "customer" | "staff"
): CustomerChatMessage {
  const senderType = String(row.sender_type ?? "customer") as "customer" | "staff";
  const isStaff = senderType === "staff";
  const hideStaffIdentity = viewer === "customer" && isStaff;
  return {
    id: String(row.id),
    conversation_id: String(row.conversation_id),
    sender_type: senderType,
    sender_user_id: hideStaffIdentity
      ? null
      : ((row.sender_user_id as string | null) ?? null),
    sender_is_owner: hideStaffIdentity ? false : Boolean(row.sender_is_owner),
    sender_name: hideStaffIdentity
      ? customerFacingStaffSenderName()
      : String(row.sender_name ?? ""),
    sender_role_label: undefined,
    body: String(row.body ?? ""),
    created_at: String(row.created_at ?? new Date().toISOString()),
    isMine: viewer === "customer" ? senderType === "customer" : Boolean(row.isMine),
  };
}

type UseCustomerChatRealtimeOptions = {
  conversationId: string | null;
  userId?: string | null;
  viewer: "customer" | "staff";
  onNewMessage: (message: CustomerChatMessage) => void;
  onInboxUpdate: () => void;
  enabled?: boolean;
};

export function useCustomerChatRealtime({
  conversationId,
  userId,
  viewer,
  onNewMessage,
  onInboxUpdate,
  enabled = true,
}: UseCustomerChatRealtimeOptions) {
  const onNewMessageRef = useRef(onNewMessage);
  const onInboxUpdateRef = useRef(onInboxUpdate);
  const realtimeActiveRef = useRef(false);

  onNewMessageRef.current = onNewMessage;
  onInboxUpdateRef.current = onInboxUpdate;

  useEffect(() => {
    if (!enabled || !supabase) return;
    const client = supabase;

    const channels: RealtimeChannel[] = [];
    realtimeActiveRef.current = false;

    const inboxChannel =
      viewer === "staff"
        ? "customer-chat:inbox:staff"
        : userId
          ? `customer-chat:inbox:user:${userId}`
          : null;

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
        .channel(`customer-chat:thread:${conversationId}`)
        .on("broadcast", { event: "new_message" }, ({ payload }) => {
          realtimeActiveRef.current = true;
          const message = (payload as { message?: Record<string, unknown> }).message;
          if (message) onNewMessageRef.current(mapRealtimeMessage(message, viewer));
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "customer_conversation_messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            realtimeActiveRef.current = true;
            if (payload.new) {
              onNewMessageRef.current(
                mapRealtimeMessage(payload.new as Record<string, unknown>, viewer)
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
  }, [conversationId, enabled, userId, viewer]);
}
