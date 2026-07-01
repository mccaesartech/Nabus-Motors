import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  buildConversationAuditContext,
  type ConversationAuditContext,
} from "@/lib/platform/team-messages-server";
import { ROLE_LABELS, type PlatformRole } from "@/lib/platform/permissions";

export type PlatformActivityLogRow = {
  id: string;
  user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  resource: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type TeamMessageRow = {
  id: string;
  conversation_id: string;
  sender_user_id: string | null;
  sender_is_owner: boolean;
  sender_name: string;
  sender_email: string;
  body: string;
  created_at: string;
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role as PlatformRole] ?? role;
}

function mergeTeamMessageMetadata(
  metadata: Record<string, unknown>,
  message: TeamMessageRow,
  context: ConversationAuditContext | null
): Record<string, unknown> {
  const senderRole =
    typeof metadata.sender_role === "string"
      ? metadata.sender_role
      : message.sender_is_owner
        ? "owner"
        : null;

  return {
    ...metadata,
    message_id: message.id,
    body: message.body,
    sent_at: message.created_at,
    sender_name: message.sender_name,
    sender_email: message.sender_email,
    sender_role: senderRole,
    conversation_id: message.conversation_id,
    ...(context
      ? {
          channel_type: context.channel_type,
          conversation_label: context.conversation_label,
          participants: context.participants,
        }
      : {}),
  };
}

/** Backfill team message details from platform_messages for older activity rows. */
export async function enrichActivityLog(
  rows: PlatformActivityLogRow[]
): Promise<PlatformActivityLogRow[]> {
  const supabase = createAdminSupabase();
  if (!supabase || rows.length === 0) return rows;

  const teamRows = rows.filter((row) => row.action === "team_message_sent");
  if (teamRows.length === 0) return rows;

  const messageIds = [
    ...new Set(
      teamRows
        .map((row) => row.metadata?.message_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];

  const messagesById = new Map<string, TeamMessageRow>();
  if (messageIds.length > 0) {
    const { data: messages } = await supabase
      .from("platform_messages")
      .select(
        "id, conversation_id, sender_user_id, sender_is_owner, sender_name, sender_email, body, created_at"
      )
      .in("id", messageIds);

    for (const message of messages ?? []) {
      messagesById.set(message.id, message as TeamMessageRow);
    }
  }

  const conversationIdsNeedingContext = [
    ...new Set(
      teamRows
        .filter((row) => {
          const meta = row.metadata ?? {};
          return !meta.conversation_label && row.resource;
        })
        .map((row) => row.resource as string)
    ),
  ];

  const contextByConversation = new Map<string, ConversationAuditContext>();
  await Promise.all(
    conversationIdsNeedingContext.map(async (conversationId) => {
      const context = await buildConversationAuditContext(supabase, conversationId);
      contextByConversation.set(conversationId, context);
    })
  );

  return rows.map((row) => {
    if (row.action !== "team_message_sent") return row;

    const meta = row.metadata ?? {};
    const messageId = typeof meta.message_id === "string" ? meta.message_id : null;
    const message = messageId ? messagesById.get(messageId) : null;
    const conversationId =
      (typeof row.resource === "string" ? row.resource : null) ??
      (typeof meta.conversation_id === "string" ? meta.conversation_id : null) ??
      message?.conversation_id ??
      null;

    const context =
      conversationId && !meta.conversation_label
        ? (contextByConversation.get(conversationId) ?? null)
        : null;

    if (!message && !context) return row;

    const enriched = message
      ? mergeTeamMessageMetadata(meta, message, context)
      : {
          ...meta,
          ...(context
            ? {
                channel_type: context.channel_type,
                conversation_label: context.conversation_label,
                participants: context.participants,
              }
            : {}),
        };

    if (enriched.sender_role && typeof enriched.sender_role === "string") {
      enriched.sender_role_label = roleLabel(enriched.sender_role);
    }

    return { ...row, metadata: enriched };
  });
}
