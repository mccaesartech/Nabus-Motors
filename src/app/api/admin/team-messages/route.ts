import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { friendlyAdminDbError } from "@/lib/admin/api-errors";
import { logPlatformActivity } from "@/lib/platform/activity";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  actorIsOwner,
  actorRole,
  actorUserId,
  canCreateTeamGroups,
  messageIsFromActor,
  type TeamMessage,
} from "@/lib/platform/team-messages";
import {
  assertConversationAccess,
  buildChannelSummaries,
  buildConversationAuditContext,
  buildConversationSummaries,
  buildRecipients,
  countUnreadTeamMessages,
  createDirectConversation,
  ensureActorInAllStaff,
  findExistingConversation,
  findMemberId,
  getOrCreateAllStaffConversation,
  loadUserMap,
  syncAllStaffMembers,
} from "@/lib/platform/team-messages-server";
import {
  broadcastTeamMessageRealtime,
  createTeamMessageNotifications,
} from "@/lib/platform/team-notifications";
import { ROLE_LABELS } from "@/lib/platform/permissions";

const TEAM_CHAT_SETUP_MESSAGE =
  "Team chat setup required — run migration 017 in Supabase. Open Supabase Dashboard → SQL Editor, paste and run supabase/migrations/017_platform_team_channels.sql, then refresh this page.";

function isChannelTypeSchemaError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("channel_type") &&
    (lower.includes("schema cache") ||
      lower.includes("does not exist") ||
      lower.includes("column"))
  );
}

async function checkTeamChannelsReady(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>
): Promise<{ ready: true } | { ready: false; message: string }> {
  const { error } = await supabase.from("platform_conversations").select("channel_type").limit(1);

  if (!error) return { ready: true };

  const message = isChannelTypeSchemaError(error.message)
    ? TEAM_CHAT_SETUP_MESSAGE
    : friendlyAdminDbError(error.message);

  return { ready: false, message };
}

export async function GET(req: NextRequest) {
  const authResult = await requirePermission("team_messages");
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  const auth = authResult.auth;
  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      configured: false,
      allStaff: null,
      groups: [],
      conversations: [],
      messages: [],
      recipients: [],
      unreadTotal: 0,
      canCreateGroups: false,
    });
  }

  const conversationId = req.nextUrl.searchParams.get("conversationId");

  // Lightweight badge poll — skips channel provisioning, member sync writes,
  // full message history, and recipient loads that the full inbox needs.
  if (req.nextUrl.searchParams.get("summary") === "1") {
    const unreadTotal = await countUnreadTeamMessages(supabase, auth);
    return NextResponse.json({ ok: true, configured: true, unreadTotal });
  }

  const channelsReady = await checkTeamChannelsReady(supabase);

  if (conversationId) {
    let channelType: string | null = null;
    if (channelsReady.ready) {
      const { data: conversation, error: convError } = await supabase
        .from("platform_conversations")
        .select("channel_type")
        .eq("id", conversationId)
        .maybeSingle();

      if (convError) {
        return NextResponse.json(
          {
            ok: false,
            setupRequired: isChannelTypeSchemaError(convError.message),
            message: friendlyAdminDbError(convError.message),
          },
          { status: 500 }
        );
      }

      channelType = conversation?.channel_type ?? null;
    }

    if (channelType === "all_staff") {
      const allStaff = await getOrCreateAllStaffConversation(supabase);
      await syncAllStaffMembers(supabase, allStaff.id);
      const member = await ensureActorInAllStaff(supabase, conversationId, auth);
      if (!member) {
        return NextResponse.json({ ok: false, message: "Conversation not found" }, { status: 404 });
      }
    } else {
      const member = await assertConversationAccess(supabase, conversationId, auth);
      if (!member) {
        return NextResponse.json({ ok: false, message: "Conversation not found" }, { status: 404 });
      }
    }

    const member = await findMemberId(supabase, conversationId, auth);
    if (!member) {
      return NextResponse.json({ ok: false, message: "Conversation not found" }, { status: 404 });
    }

    const { data: rawMessages, error } = await supabase
      .from("platform_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    const now = new Date().toISOString();
    await supabase
      .from("platform_conversation_members")
      .update({ last_read_at: now })
      .eq("id", member.id);

    const messages: TeamMessage[] = (rawMessages ?? []).map((msg) => ({
      id: msg.id,
      conversation_id: msg.conversation_id,
      sender_user_id: msg.sender_user_id,
      sender_is_owner: msg.sender_is_owner,
      sender_name: msg.sender_name,
      sender_email: msg.sender_email,
      body: msg.body,
      created_at: msg.created_at,
      isMine: messageIsFromActor(auth, msg),
    }));

    return NextResponse.json({ ok: true, messages });
  }

  const userMap = await loadUserMap(supabase);

  let conversations: Awaited<ReturnType<typeof buildConversationSummaries>> = [];
  let allStaff: Awaited<ReturnType<typeof buildChannelSummaries>>["allStaff"] = null;
  let groups: Awaited<ReturnType<typeof buildChannelSummaries>>["groups"] = [];
  let setupRequired = !channelsReady.ready;
  let setupMessage = channelsReady.ready ? null : channelsReady.message;

  try {
    conversations = await buildConversationSummaries(supabase, auth, userMap);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load conversations";
    if (!setupRequired && isChannelTypeSchemaError(message)) {
      setupRequired = true;
      setupMessage = TEAM_CHAT_SETUP_MESSAGE;
    } else if (!setupRequired) {
      return NextResponse.json(
        { ok: false, message: friendlyAdminDbError(message) },
        { status: 500 }
      );
    }
  }

  if (channelsReady.ready) {
    try {
      const channelData = await buildChannelSummaries(supabase, auth, ["all_staff", "group"]);
      allStaff = channelData.allStaff;
      groups = channelData.groups;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load channels";
      if (isChannelTypeSchemaError(message)) {
        setupRequired = true;
        setupMessage = TEAM_CHAT_SETUP_MESSAGE;
      } else {
        return NextResponse.json(
          { ok: false, message: friendlyAdminDbError(message) },
          { status: 500 }
        );
      }
    }
  }

  const recipients = await buildRecipients(supabase, auth);

  const unreadTotal =
    conversations.reduce((sum, c) => sum + c.unreadCount, 0) +
    groups.reduce((sum, g) => sum + g.unreadCount, 0) +
    (allStaff?.unreadCount ?? 0);

  return NextResponse.json({
    ok: true,
    configured: true,
    setupRequired,
    setupMessage,
    allStaff,
    groups,
    conversations,
    recipients,
    unreadTotal,
    canCreateGroups: channelsReady.ready && canCreateTeamGroups(actorRole(auth)),
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requirePermission("team_messages");
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  const auth = authResult.auth;
  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const body = await req.json();
  const text = String(body.body ?? "").trim();
  if (!text) {
    return NextResponse.json({ ok: false, message: "Message body required" }, { status: 400 });
  }

  let conversationId = body.conversationId ? String(body.conversationId) : null;
  const recipientUserId = body.recipientUserId ? String(body.recipientUserId) : null;
  const recipientIsOwner = Boolean(body.recipientIsOwner);

  if (!conversationId) {
    if (!recipientUserId && !recipientIsOwner) {
      return NextResponse.json(
        { ok: false, message: "Recipient or conversation required" },
        { status: 400 }
      );
    }

    if (recipientUserId && recipientUserId === actorUserId(auth)) {
      return NextResponse.json({ ok: false, message: "Cannot message yourself" }, { status: 400 });
    }

    if (recipientIsOwner && actorIsOwner(auth)) {
      return NextResponse.json({ ok: false, message: "Cannot message yourself" }, { status: 400 });
    }

    if (recipientUserId) {
      const { data: recipient } = await supabase
        .from("platform_users")
        .select("id, status")
        .eq("id", recipientUserId)
        .maybeSingle();

      if (!recipient || recipient.status !== "active") {
        return NextResponse.json({ ok: false, message: "Recipient not found" }, { status: 404 });
      }
    }

    conversationId = await findExistingConversation(supabase, auth, recipientUserId, recipientIsOwner);
    if (!conversationId) {
      conversationId = await createDirectConversation(
        supabase,
        auth,
        recipientUserId,
        recipientIsOwner
      );
    }
  } else {
    const { data: conversation } = await supabase
      .from("platform_conversations")
      .select("channel_type")
      .eq("id", conversationId)
      .maybeSingle();

    if (!conversation) {
      return NextResponse.json({ ok: false, message: "Conversation not found" }, { status: 404 });
    }

    if (conversation.channel_type === "all_staff") {
      const allStaff = await getOrCreateAllStaffConversation(supabase);
      await syncAllStaffMembers(supabase, allStaff.id);
      const member = await ensureActorInAllStaff(supabase, conversationId, auth);
      if (!member) {
        return NextResponse.json({ ok: false, message: "Conversation not found" }, { status: 404 });
      }
    } else {
      const member = await assertConversationAccess(supabase, conversationId, auth);
      if (!member) {
        return NextResponse.json({ ok: false, message: "Conversation not found" }, { status: 404 });
      }
    }
  }

  const now = new Date().toISOString();
  const { data: message, error } = await supabase
    .from("platform_messages")
    .insert({
      conversation_id: conversationId,
      sender_user_id: actorIsOwner(auth) ? null : actorUserId(auth),
      sender_is_owner: actorIsOwner(auth),
      sender_name: auth.name,
      sender_email: auth.email,
      body: text,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  await supabase
    .from("platform_conversations")
    .update({ updated_at: now })
    .eq("id", conversationId);

  const member = await findMemberId(supabase, conversationId, auth);
  if (member) {
    await supabase
      .from("platform_conversation_members")
      .update({ last_read_at: now })
      .eq("id", member.id);
  }

  const auditContext = await buildConversationAuditContext(supabase, conversationId);
  const senderRole = actorRole(auth);

  await logPlatformActivity(auth, "team_message_sent", conversationId, {
    message_id: message.id,
    body: message.body,
    sent_at: message.created_at,
    sender_name: message.sender_name,
    sender_email: message.sender_email,
    sender_role: senderRole,
    sender_role_label: ROLE_LABELS[senderRole as keyof typeof ROLE_LABELS] ?? senderRole,
    conversation_id: conversationId,
    channel_type: auditContext.channel_type,
    conversation_label: auditContext.conversation_label,
    participants: auditContext.participants,
  });

  const notifications = await createTeamMessageNotifications(
    supabase,
    auth,
    message,
    auditContext
  );
  await broadcastTeamMessageRealtime(supabase, auth, message, notifications);

  return NextResponse.json({
    ok: true,
    conversationId,
    message: {
      id: message.id,
      conversation_id: message.conversation_id,
      sender_user_id: message.sender_user_id,
      sender_is_owner: message.sender_is_owner,
      sender_name: message.sender_name,
      sender_email: message.sender_email,
      body: message.body,
      created_at: message.created_at,
      isMine: true,
    } satisfies TeamMessage,
  });
}
