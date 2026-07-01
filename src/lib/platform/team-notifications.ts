import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import { actorIsOwner, actorUserId } from "@/lib/platform/team-messages";
import type { ConversationAuditContext } from "@/lib/platform/team-messages-server";

const MESSAGE_PREVIEW_LEN = 80;

export type TeamMessageNotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  source_table: string | null;
  source_id: string | null;
  read_at: string | null;
  created_at: string;
  recipient_user_id: string | null;
  recipient_is_owner: boolean;
  metadata?: Record<string, unknown> | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string | null;
  sender_is_owner: boolean;
  sender_name: string;
  sender_email: string;
  body: string;
  created_at: string;
};

type MemberRow = {
  user_id: string | null;
  is_owner: boolean;
};

export function truncateTeamMessagePreview(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= MESSAGE_PREVIEW_LEN) return trimmed;
  return `${trimmed.slice(0, MESSAGE_PREVIEW_LEN)}…`;
}

export function teamChatConversationLink(conversationId: string): string {
  return `/platform/team-chat?conversation=${encodeURIComponent(conversationId)}`;
}

export function teamChatInboxChannel(auth: PlatformAuthContext): string {
  if (actorIsOwner(auth)) return "team-chat:inbox:owner";
  return `team-chat:inbox:user:${actorUserId(auth)}`;
}

export function adminNotificationChannel(recipient: MemberRow): string {
  if (recipient.is_owner) return "notifications:owner";
  return `notifications:user:${recipient.user_id}`;
}

function channelLabel(audit: ConversationAuditContext): string {
  if (audit.channel_type === "all_staff") return "All Staff";
  if (audit.channel_type === "group") {
    const name = audit.conversation_label.replace(/^Group:\s*/, "");
    return name || "Group";
  }
  return "Direct message";
}

function memberIsSender(member: MemberRow, auth: PlatformAuthContext): boolean {
  if (actorIsOwner(auth)) return member.is_owner;
  return !member.is_owner && member.user_id === actorUserId(auth);
}

async function subscribeAndSend(
  supabase: SupabaseClient,
  channelName: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const channel: RealtimeChannel = supabase.channel(channelName, {
    config: { broadcast: { ack: false, self: false } },
  });

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      void supabase.removeChannel(channel);
      resolve();
    }, 3000);

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel
          .send({
            type: "broadcast",
            event,
            payload,
          })
          .finally(() => {
            clearTimeout(timeout);
            void supabase.removeChannel(channel);
            resolve();
          });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timeout);
        void supabase.removeChannel(channel);
        resolve();
      }
    });
  });
}

export async function createTeamMessageNotifications(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  message: MessageRow,
  audit: ConversationAuditContext
): Promise<TeamMessageNotificationRow[]> {
  const { data: members } = await supabase
    .from("platform_conversation_members")
    .select("user_id, is_owner")
    .eq("conversation_id", message.conversation_id);

  const recipients = (members ?? []).filter(
    (member) => !memberIsSender(member as MemberRow, auth)
  ) as MemberRow[];

  if (recipients.length === 0) return [];

  const label = channelLabel(audit);
  const preview = truncateTeamMessagePreview(message.body);
  const link = teamChatConversationLink(message.conversation_id);

  const rows = recipients.map((recipient) => ({
    type: "team_message",
    title: `${message.sender_name} · ${label}`,
    message: preview,
    link,
    source_table: "platform_messages",
    source_id: message.id,
    recipient_user_id: recipient.is_owner ? null : recipient.user_id,
    recipient_is_owner: recipient.is_owner,
    metadata: {
      conversation_id: message.conversation_id,
      channel_type: audit.channel_type,
      channel_label: label,
      sender_name: message.sender_name,
      message_preview: preview,
    },
  }));

  const { data, error } = await supabase
    .from("admin_notifications")
    .insert(rows)
    .select("*");

  if (error) {
    console.error("team message notifications insert failed:", error.message);
    return [];
  }

  return (data ?? []) as TeamMessageNotificationRow[];
}

export async function broadcastTeamMessageRealtime(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  message: MessageRow,
  notifications: TeamMessageNotificationRow[]
): Promise<void> {
  const messagePayload = {
    id: message.id,
    conversation_id: message.conversation_id,
    sender_user_id: message.sender_user_id,
    sender_is_owner: message.sender_is_owner,
    sender_name: message.sender_name,
    sender_email: message.sender_email,
    body: message.body,
    created_at: message.created_at,
    isMine: false,
  };

  const inboxPayload = {
    conversationId: message.conversation_id,
    lastMessage: {
      body: message.body,
      created_at: message.created_at,
      sender_name: message.sender_name,
    },
  };

  await subscribeAndSend(supabase, `team-chat:${message.conversation_id}`, "new_message", {
    message: messagePayload,
  });

  const { data: members } = await supabase
    .from("platform_conversation_members")
    .select("user_id, is_owner")
    .eq("conversation_id", message.conversation_id);

  const recipientChannels = new Set<string>();
  for (const member of (members ?? []) as MemberRow[]) {
    if (memberIsSender(member, auth)) continue;
    recipientChannels.add(adminNotificationChannel(member));
    recipientChannels.add(
      member.is_owner ? "team-chat:inbox:owner" : `team-chat:inbox:user:${member.user_id}`
    );
  }

  await Promise.all([
    ...[...recipientChannels].map((channelName) =>
      channelName.startsWith("team-chat:inbox:")
        ? subscribeAndSend(supabase, channelName, "inbox_update", inboxPayload)
        : Promise.resolve()
    ),
    ...notifications.map((notification) => {
      const channelName = notification.recipient_is_owner
        ? "notifications:owner"
        : `notifications:user:${notification.recipient_user_id}`;
      return subscribeAndSend(supabase, channelName, "new_notification", {
        notification: {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          link: notification.link,
          sourceTable: notification.source_table,
          sourceId: notification.source_id,
          readAt: notification.read_at,
          createdAt: notification.created_at,
          metadata: notification.metadata ?? undefined,
        },
      });
    }),
  ]);
}
