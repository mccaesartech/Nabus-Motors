import { NextRequest, NextResponse } from "next/server";
import { dbFailure } from "@/lib/errors/api";
import { requirePermission } from "@/lib/admin/auth";
import {
  buildConversationSummaries,
  claimSupportTicket,
  closeSupportTicket,
  insertStaffMessage,
  listPlatformUsersForAssignment,
  listSelectableCustomers,
  loadConversationMessagesForStaff,
  mapStaffMessage,
  reassignSupportTicket,
  staffHasTicketOversight,
} from "@/lib/customer/conversations-server";
import { CUSTOMER_MESSAGE_STATUSES, type CustomerMessageCategory } from "@/lib/customer/types";
import { logPlatformActivity } from "@/lib/platform/activity";
import {
  broadcastCustomerChatRealtime,
  createCustomerMessageNotifications,
  createTicketClaimedNotification,
  createTicketClosedNotification,
  createTicketReopenedNotifications,
  notifyCustomerOfStaffMessage,
} from "@/lib/platform/customer-chat-notifications";
import { notifyCustomerStaffMessage } from "@/lib/customer/notifications-server";
import { formatCustomerNotificationFeedback } from "@/lib/notifications/notification-status";
import { normalizeBatchIds, softDeleteEntities } from "@/lib/platform/trash";
import { softDeleteAdminNotificationsBySource } from "@/lib/platform/admin-notification-trash";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const auth = await requirePermission("messages");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, conversations: [], customers: [] });
  }

  const conversationId = req.nextUrl.searchParams.get("conversationId");
  const userId = req.nextUrl.searchParams.get("userId") ?? undefined;
  const listCustomers = req.nextUrl.searchParams.get("customers") === "1";

  if (conversationId) {
    const messages = await loadConversationMessagesForStaff(
      supabase,
      auth.auth,
      conversationId
    );
    if ("error" in messages) {
      return NextResponse.json({ ok: false, message: messages.error }, { status: 403 });
    }
    return NextResponse.json({ ok: true, messages });
  }

  const canOversight = staffHasTicketOversight(auth.auth);
  const [conversations, customers, platformUsers] = await Promise.all([
    buildConversationSummaries(supabase, auth.auth, userId),
    listCustomers ? listSelectableCustomers(supabase) : Promise.resolve(undefined),
    listCustomers && canOversight
      ? listPlatformUsersForAssignment(supabase)
      : Promise.resolve(undefined),
  ]);

  return NextResponse.json({
    ok: true,
    conversations,
    canOversight,
    canDelete: true,
    ...(customers ? { customers } : {}),
    ...(platformUsers ? { platformUsers } : {}),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("messages");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const body = await req.json();
  const action = String(body.action ?? "message");

  if (action === "claim") {
    const ticketId = String(body.id ?? body.conversationId ?? "");
    if (!ticketId) {
      return NextResponse.json({ ok: false, message: "Missing ticket id" }, { status: 400 });
    }

    const result = await claimSupportTicket(supabase, auth.auth, ticketId);
    if ("error" in result) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 409 });
    }

    await logPlatformActivity(auth.auth, "ticket_claimed", ticketId, {
      customer_email: result.conversation.customer_email,
    });

    await createTicketClaimedNotification(supabase, result.conversation, auth.auth);
    await broadcastCustomerChatRealtime(
      supabase,
      {
        id: ticketId,
        conversation_id: ticketId,
        sender_type: "staff",
        sender_user_id: null,
        sender_is_owner: false,
        sender_name: auth.auth.name,
        body: "",
        created_at: new Date().toISOString(),
      },
      result.conversation,
      [],
      "staff"
    );

    const conversations = await buildConversationSummaries(supabase, auth.auth);
    return NextResponse.json({
      ok: true,
      conversation: conversations.find((c) => c.id === ticketId) ?? null,
    });
  }

  if (action === "reassign") {
    const ticketId = String(body.id ?? body.conversationId ?? "");
    if (!ticketId) {
      return NextResponse.json({ ok: false, message: "Missing ticket id" }, { status: 400 });
    }

    const assignTo = body.assignTo;
    let assigneeUserId: string | null = null;
    let assigneeIsOwner = false;

    if (assignTo === "owner") {
      assigneeIsOwner = true;
    } else if (assignTo === "unassigned" || assignTo === null || assignTo === "") {
      assigneeUserId = null;
      assigneeIsOwner = false;
    } else {
      assigneeUserId = String(assignTo);
    }

    const result = await reassignSupportTicket(
      supabase,
      auth.auth,
      ticketId,
      assigneeUserId,
      assigneeIsOwner
    );
    if ("error" in result) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 400 });
    }

    await logPlatformActivity(auth.auth, "ticket_reassigned", ticketId, {
      customer_email: result.conversation.customer_email,
      assigned_to_user_id: result.conversation.assigned_to_user_id,
      assigned_to_is_owner: result.conversation.assigned_to_is_owner,
    });

    const conversations = await buildConversationSummaries(supabase, auth.auth);
    return NextResponse.json({
      ok: true,
      conversation: conversations.find((c) => c.id === ticketId) ?? null,
    });
  }

  if (action === "close") {
    const ticketId = String(body.id ?? body.conversationId ?? "");
    if (!ticketId) {
      return NextResponse.json({ ok: false, message: "Missing ticket id" }, { status: 400 });
    }

    const result = await closeSupportTicket(
      supabase,
      auth.auth,
      ticketId,
      body.resolutionNote ? String(body.resolutionNote) : undefined
    );
    if ("error" in result) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 400 });
    }

    await logPlatformActivity(auth.auth, "ticket_closed", ticketId, {
      customer_email: result.conversation.customer_email,
      resolution_note: result.conversation.resolution_note,
    });

    await createTicketClosedNotification(supabase, result.conversation, auth.auth);
    await broadcastCustomerChatRealtime(
      supabase,
      {
        id: ticketId,
        conversation_id: ticketId,
        sender_type: "staff",
        sender_user_id: null,
        sender_is_owner: false,
        sender_name: auth.auth.name,
        body: "",
        created_at: new Date().toISOString(),
      },
      result.conversation,
      [],
      "staff"
    );

    const conversations = await buildConversationSummaries(supabase, auth.auth);
    return NextResponse.json({
      ok: true,
      conversation: conversations.find((c) => c.id === ticketId) ?? null,
    });
  }

  const result = await insertStaffMessage(supabase, auth.auth, {
    conversationId: body.conversationId ? String(body.conversationId) : undefined,
    userId: body.userId ? String(body.userId) : undefined,
    email: body.email ? String(body.email) : undefined,
    name: body.name ? String(body.name) : undefined,
    phone: body.phone ? String(body.phone) : undefined,
    subject: body.subject ? String(body.subject) : undefined,
    category: body.category
      ? (String(body.category) as CustomerMessageCategory)
      : undefined,
    body: String(body.body ?? ""),
    partsOrderId: body.partsOrderId ? String(body.partsOrderId) : undefined,
    assignToUserId: body.assignToUserId ? String(body.assignToUserId) : undefined,
    assignToIsOwner: body.assignToIsOwner === true || body.assignTo === "owner",
    assignToUnassigned: body.assignTo === "unassigned" || body.assignToUnassigned === true,
  });

  if ("error" in result) {
    return NextResponse.json({ ok: false, message: result.error }, { status: 400 });
  }

  const { conversation, message, isNewConversation } = result;
  const mapped = mapStaffMessage(auth.auth, message);

  await logPlatformActivity(
    auth.auth,
    isNewConversation ? "conversation_started" : "message_replied",
    conversation.id,
    {
      message_id: message.id,
      body: message.body,
      customer_email: conversation.customer_email,
      initiated_by: isNewConversation ? "staff" : undefined,
    }
  );

  const notificationResult = await notifyCustomerOfStaffMessage(supabase, message, conversation);
  await broadcastCustomerChatRealtime(supabase, message, conversation, [], "staff");

  const preview =
    message.body.trim().length > 80
      ? `${message.body.trim().slice(0, 80)}…`
      : message.body.trim();
  await notifyCustomerStaffMessage(supabase, {
    userId: conversation.user_id,
    conversationId: conversation.id,
    subject: conversation.subject,
    preview,
    messageId: message.id,
    staffName: message.sender_name,
  });

  const feedback = formatCustomerNotificationFeedback(notificationResult, {
    savedPrefix: isNewConversation ? "Message sent" : "Reply sent",
  });

  return NextResponse.json({
    ok: true,
    conversationId: conversation.id,
    message: mapped,
    notification: notificationResult,
    notificationMessage: feedback.message,
    notificationVariant: feedback.variant,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission("messages");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const queryId = req.nextUrl.searchParams.get("id");
  let ids: string[] = [];
  if (queryId?.trim()) {
    ids = [queryId.trim()];
  } else {
    const body = (await req.json().catch(() => ({}))) as { ids?: unknown; id?: unknown };
    if (typeof body.id === "string" && body.id.trim()) {
      ids = [body.id.trim()];
    } else {
      ids = normalizeBatchIds(body.ids);
    }
  }

  if (ids.length === 0) {
    return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
  }

  const batch = await softDeleteEntities(supabase, auth.auth, "support_ticket", ids);

  if (batch.deletedIds.length > 0) {
    const messageIds =
      (
        await supabase
          .from("customer_conversation_messages")
          .select("id")
          .in("conversation_id", batch.deletedIds)
      ).data?.map((row) => String(row.id)) ?? [];

    await Promise.all([
      softDeleteAdminNotificationsBySource(
        supabase,
        auth.auth,
        "customer_conversations",
        batch.deletedIds
      ),
      messageIds.length > 0
        ? softDeleteAdminNotificationsBySource(
            supabase,
            auth.auth,
            "customer_conversation_messages",
            messageIds
          )
        : Promise.resolve(),
    ]);

    await logPlatformActivity(
      auth.auth,
      "ticket_deleted",
      batch.deletedIds.length === 1
        ? batch.deletedIds[0]
        : `${batch.deletedIds.length} support tickets`
    );
  }

  if (batch.deletedIds.length === 0) {
    const first = batch.failed[0];
    const message = first?.message ?? "Could not move tickets to trash.";
    const status =
      /deleted_at/i.test(message) || /schema cache/i.test(message)
        ? 503
        : first?.message === "Record not found."
          ? 404
          : 500;
    if (status === 503) {
      const { reportSchemaIssue } = await import("@/lib/observability/schema-issue");
      reportSchemaIssue({
        table: "customer_conversations",
        column: "deleted_at",
        migration: "079_support_ticket_soft_delete.sql",
        source: "api.admin.customer-messages.DELETE",
        message,
      });
    }
    return NextResponse.json(
      {
        ok: false,
        message:
          status === 503
            ? "Support ticket trash is temporarily unavailable. Please try again later."
            : message,
        failed: batch.failed,
        deletedIds: [],
      },
      { status }
    );
  }

  return NextResponse.json({
    ok: true,
    deletedIds: batch.deletedIds,
    failed: batch.failed,
    message:
      batch.deletedIds.length === 1
        ? "Ticket moved to trash."
        : `${batch.deletedIds.length} tickets moved to trash.`,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission("messages");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const body = await req.json();
  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  if (body.status !== undefined) {
    const status = String(body.status);
    if (!CUSTOMER_MESSAGE_STATUSES.includes(status as (typeof CUSTOMER_MESSAGE_STATUSES)[number])) {
      return NextResponse.json({ ok: false, message: "Invalid status" }, { status: 400 });
    }
    updates.status = status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, message: "No updates provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("customer_conversations")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return dbFailure(error, {
      module: "api.admin.customer-messages.PATCH",
      message: "The message could not be sent. Try again.",
      request: req,
    });
  }

  return NextResponse.json({ ok: true, conversation: data });
}
