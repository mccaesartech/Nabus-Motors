import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import { hasPermission, normalizeRole } from "@/lib/platform/permissions";
import { resolveCustomerContactByUserId } from "@/lib/notifications/customer-contact";
import { notifyCustomer } from "@/lib/notifications/customer-notify";
import type { CustomerNotificationPayload } from "@/lib/notifications/notification-status";

const MESSAGE_PREVIEW_LEN = 80;

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_type: "customer" | "staff";
  sender_user_id: string | null;
  sender_is_owner: boolean;
  sender_name: string;
  body: string;
  created_at: string;
};

type ConversationRow = {
  id: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  subject: string;
  status?: string;
  assigned_to_user_id?: string | null;
  assigned_to_is_owner?: boolean;
};

export type CustomerChatNotificationRow = {
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

function truncatePreview(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= MESSAGE_PREVIEW_LEN) return trimmed;
  return `${trimmed.slice(0, MESSAGE_PREVIEW_LEN)}…`;
}

export function customerChatConversationLink(conversationId: string): string {
  return `/platform/messages?conversation=${encodeURIComponent(conversationId)}`;
}

export function customerAccountMessagesLink(): string {
  return "/account";
}

export async function notifyCustomerOfStaffMessage(
  supabase: SupabaseClient,
  message: MessageRow,
  conversation: ConversationRow
): Promise<CustomerNotificationPayload | null> {
  const { sendCustomerStaffMessageEmail } = await import(
    "@/lib/email/customer-message"
  );

  const preview = truncatePreview(message.body);
  const contact = await resolveCustomerContactByUserId(supabase, conversation.user_id);
  const emailTo = conversation.customer_email?.trim() || contact.email;

  let emailSent = false;
  if (emailTo) {
    const mail = await sendCustomerStaffMessageEmail({
      to: emailTo,
      customerName: conversation.customer_name,
      subject: conversation.subject,
      preview,
      staffName: message.sender_name,
    });
    emailSent = mail.emailSent;
  }

  const notify = await notifyCustomer({
    email: emailTo,
    phone: contact.phone,
    whatsappPreferred: contact.whatsappPreferred,
    customerName: conversation.customer_name || contact.customerName,
    template: "staff_message",
    data: {
      messageSubject: conversation.subject,
      messagePreview: preview,
      staffName: message.sender_name,
    },
    sourceTable: "customer_conversation_messages",
    sourceId: message.id,
    skipEmail: true,
  });

  return {
    ...notify,
    emailSent: emailSent || notify.emailSent,
    emailStatus: emailSent ? "sent" : notify.emailStatus,
    channels: [
      ...notify.channels,
      ...(emailSent && !notify.channels.includes("email") ? ["email"] : []),
    ],
  };
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
          .send({ type: "broadcast", event, payload })
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

async function staffMessageRecipients(supabase: SupabaseClient) {
  const recipients: Array<{ user_id: string | null; is_owner: boolean }> = [
    { user_id: null, is_owner: true },
  ];

  const { data } = await supabase
    .from("platform_users")
    .select("id, role, status")
    .eq("status", "active");

  for (const user of data ?? []) {
    const role = normalizeRole(user.role);
    if (hasPermission(role, "messages")) {
      recipients.push({ user_id: user.id, is_owner: false });
    }
  }

  return recipients;
}

async function insertNotifications(
  supabase: SupabaseClient,
  rows: Array<{
    type: string;
    title: string;
    message: string;
    link: string;
    source_table: string;
    source_id: string;
    recipient_user_id: string | null;
    recipient_is_owner: boolean;
    metadata?: Record<string, unknown>;
  }>
): Promise<CustomerChatNotificationRow[]> {
  if (rows.length === 0) return [];

  const { data, error } = await supabase
    .from("admin_notifications")
    .insert(rows)
    .select("*");

  if (error) {
    console.error("customer chat notifications insert failed:", error.message);
    return [];
  }

  return (data ?? []) as CustomerChatNotificationRow[];
}

function ticketRecipients(
  conversation: ConversationRow,
  mode: "new_message" | "reopened"
): Array<{ user_id: string | null; is_owner: boolean }> {
  const isClaimed =
    conversation.status === "claimed" ||
    conversation.assigned_to_is_owner ||
    Boolean(conversation.assigned_to_user_id);

  if (mode === "new_message" && isClaimed) {
    if (conversation.assigned_to_is_owner) {
      return [{ user_id: null, is_owner: true }];
    }
    if (conversation.assigned_to_user_id) {
      return [{ user_id: conversation.assigned_to_user_id, is_owner: false }];
    }
  }

  return [];
}

export async function createCustomerMessageNotifications(
  supabase: SupabaseClient,
  message: MessageRow,
  conversation: ConversationRow,
  mode: "new_message" | "reopened" = "new_message"
): Promise<CustomerChatNotificationRow[]> {
  const preview = truncatePreview(message.body);
  const link = customerChatConversationLink(conversation.id);

  let recipients =
    mode === "reopened"
      ? await staffMessageRecipients(supabase)
      : ticketRecipients(conversation, mode);

  if (recipients.length === 0 && mode === "new_message") {
    recipients = await staffMessageRecipients(supabase);
  }

  const notificationType =
    mode === "reopened" ? "support_ticket_reopened" : "customer_message";

  return insertNotifications(
    supabase,
    recipients.map((recipient) => ({
      type: notificationType,
      title: `${conversation.customer_name} · ${conversation.subject}`,
      message:
        mode === "reopened"
          ? "Customer reopened this support ticket — available in queue."
          : preview,
      link,
      source_table: "customer_conversation_messages",
      source_id: message.id,
      recipient_user_id: recipient.is_owner ? null : recipient.user_id,
      recipient_is_owner: recipient.is_owner,
      metadata: {
        conversation_id: conversation.id,
        customer_name: conversation.customer_name,
        customer_email: conversation.customer_email,
        subject: conversation.subject,
        message_preview: preview,
        ticket_status: conversation.status,
      },
    }))
  );
}

export async function createTicketReopenedNotifications(
  supabase: SupabaseClient,
  conversation: ConversationRow
): Promise<CustomerChatNotificationRow[]> {
  const recipients = await staffMessageRecipients(supabase);
  const link = customerChatConversationLink(conversation.id);

  return insertNotifications(
    supabase,
    recipients.map((recipient) => ({
      type: "support_ticket_reopened",
      title: `Reopened · ${conversation.customer_name}`,
      message: `${conversation.subject} is back in the support queue.`,
      link,
      source_table: "customer_conversations",
      source_id: conversation.id,
      recipient_user_id: recipient.is_owner ? null : recipient.user_id,
      recipient_is_owner: recipient.is_owner,
      metadata: {
        conversation_id: conversation.id,
        customer_name: conversation.customer_name,
        subject: conversation.subject,
      },
    }))
  );
}

export async function createTicketClaimedNotification(
  supabase: SupabaseClient,
  conversation: ConversationRow,
  auth: PlatformAuthContext
): Promise<CustomerChatNotificationRow[]> {
  const link = customerChatConversationLink(conversation.id);
  return insertNotifications(supabase, [
    {
      type: "support_ticket_claimed",
      title: `You accepted · ${conversation.customer_name}`,
      message: conversation.subject,
      link,
      source_table: "customer_conversations",
      source_id: conversation.id,
      recipient_user_id: auth.type === "owner" ? null : (auth.userId ?? null),
      recipient_is_owner: auth.type === "owner",
      metadata: {
        conversation_id: conversation.id,
        customer_name: conversation.customer_name,
      },
    },
  ]);
}

export async function createTicketClosedNotification(
  _supabase: SupabaseClient,
  _conversation: ConversationRow & { resolution_note?: string | null },
  _auth: PlatformAuthContext
): Promise<CustomerChatNotificationRow[]> {
  // Customer is notified via realtime inbox broadcast, not admin_notifications.
  return [];
}

export async function broadcastCustomerChatRealtime(
  supabase: SupabaseClient,
  message: MessageRow,
  conversation: ConversationRow,
  notifications: CustomerChatNotificationRow[],
  viewer: "customer" | "staff"
): Promise<void> {
  const messagePayload = {
    id: message.id,
    conversation_id: message.conversation_id,
    sender_type: message.sender_type,
    sender_user_id: message.sender_user_id,
    sender_is_owner: message.sender_is_owner,
    sender_name: message.sender_name,
    body: message.body,
    created_at: message.created_at,
    isMine: false,
  };

  const inboxPayload = {
    conversationId: conversation.id,
    userId: conversation.user_id,
    lastMessage: {
      body: message.body,
      created_at: message.created_at,
      sender_name: message.sender_name,
      sender_type: message.sender_type,
    },
  };

  const tasks: Promise<void>[] = [
    subscribeAndSend(
      supabase,
      `customer-chat:thread:${conversation.id}`,
      "new_message",
      { message: messagePayload }
    ),
    subscribeAndSend(
      supabase,
      `customer-chat:inbox:user:${conversation.user_id}`,
      "inbox_update",
      inboxPayload
    ),
    subscribeAndSend(supabase, "customer-chat:inbox:staff", "inbox_update", inboxPayload),
  ];

  if (viewer === "customer") {
    for (const notification of notifications) {
      const channelName = notification.recipient_is_owner
        ? "notifications:owner"
        : `notifications:user:${notification.recipient_user_id}`;
      tasks.push(
        subscribeAndSend(supabase, channelName, "new_notification", {
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
        })
      );
    }
  }

  await Promise.all(tasks);
}
