import { NextRequest, NextResponse } from "next/server";
import { customerDisplayName, getCustomerFromAuthHeader } from "@/lib/customer/auth";
import {
  buildCustomerConversationSummaries,
  loadConversationMessagesForCustomer,
  mapCustomerMessage,
  reopenSupportTicketForCustomer,
  returnTicketToQueue,
} from "@/lib/customer/conversations-server";
import {
  CUSTOMER_MESSAGE_CATEGORIES,
  type CustomerMessageCategory,
} from "@/lib/customer/types";
import {
  broadcastCustomerChatRealtime,
  createCustomerMessageNotifications,
  createTicketReopenedNotifications,
} from "@/lib/platform/customer-chat-notifications";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createCustomerSupabase } from "@/lib/supabase/customer";

const VALID_CATEGORIES = new Set<string>(
  CUSTOMER_MESSAGE_CATEGORIES.map((c) => c.value)
);

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export async function GET(req: NextRequest) {
  const token = getBearerToken(req);
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user || !token) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const conversationId = req.nextUrl.searchParams.get("conversationId");
  const supabase = createCustomerSupabase(token) ?? createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, conversations: [] });
  }

  if (conversationId) {
    const { data: conversation } = await supabase
      .from("customer_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!conversation) {
      return NextResponse.json({ ok: false, message: "Conversation not found" }, { status: 404 });
    }

    const messages = await loadConversationMessagesForCustomer(
      createAdminSupabase() ?? supabase,
      user.id,
      conversationId
    );

    return NextResponse.json({ ok: true, messages });
  }

  const admin = createAdminSupabase() ?? supabase;
  const conversations = await buildCustomerConversationSummaries(admin, user.id);
  return NextResponse.json({ ok: true, conversations });
}

export async function POST(req: NextRequest) {
  const token = getBearerToken(req);
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user?.email || !token) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const action = String(body.action ?? "message");

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { ok: false, message: "Messaging is not configured yet." },
      { status: 503 }
    );
  }

  if (action === "reopen") {
    const conversationId = String(body.conversationId ?? "");
    if (!conversationId) {
      return NextResponse.json({ ok: false, message: "Missing conversation id" }, { status: 400 });
    }

    const result = await reopenSupportTicketForCustomer(admin, conversationId, user.id);
    if ("error" in result) {
      return NextResponse.json({ ok: false, message: result.error }, { status: 400 });
    }

    const notifications = await createTicketReopenedNotifications(admin, result.conversation);
    await broadcastCustomerChatRealtime(
      admin,
      {
        id: conversationId,
        conversation_id: conversationId,
        sender_type: "customer",
        sender_user_id: null,
        sender_is_owner: false,
        sender_name: result.conversation.customer_name,
        body: "",
        created_at: new Date().toISOString(),
      },
      result.conversation,
      notifications,
      "customer"
    );

    const conversations = await buildCustomerConversationSummaries(admin, user.id);
    return NextResponse.json({
      ok: true,
      conversation: conversations.find((c) => c.id === conversationId) ?? null,
    });
  }

  const messageBody = String(body.body ?? "").trim();
  const conversationId = body.conversationId ? String(body.conversationId) : undefined;
  const subject = String(body.subject ?? "").trim();
  const category = String(body.category ?? "general");
  const preorderId = body.preorderId ? String(body.preorderId) : undefined;

  if (!messageBody) {
    return NextResponse.json({ ok: false, message: "Message is required." }, { status: 400 });
  }

  const profileRes = await admin
    .from("profiles")
    .select("first_name, last_name, phone, registration_id, email")
    .eq("id", user.id)
    .maybeSingle();

  const name = customerDisplayName(
    profileRes.data
      ? {
          id: user.id,
          first_name: profileRes.data.first_name,
          last_name: profileRes.data.last_name,
          phone: profileRes.data.phone,
          registration_id: profileRes.data.registration_id,
        }
      : null,
    user
  );

  const now = new Date().toISOString();
  let activeConversationId = conversationId;
  let reopenedFromClosed = false;

  if (!activeConversationId) {
    if (!subject) {
      return NextResponse.json(
        { ok: false, message: "Subject is required for a new conversation." },
        { status: 400 }
      );
    }
    if (!VALID_CATEGORIES.has(category)) {
      return NextResponse.json({ ok: false, message: "Invalid category." }, { status: 400 });
    }

    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      customer_name: name,
      customer_email: user.email,
      registration_id: profileRes.data?.registration_id ?? null,
      subject,
      category: category as CustomerMessageCategory,
      status: "open",
      created_by: "customer",
      customer_last_read_at: now,
    };

    if (preorderId) {
      const { data: preorder } = await admin
        .from("preorder_inquiries")
        .select("id")
        .eq("id", preorderId)
        .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
        .maybeSingle();
      if (preorder) insertPayload.preorder_id = preorder.id;
    }

    const { data: conversation, error } = await admin
      .from("customer_conversations")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error || !conversation) {
      return NextResponse.json(
        { ok: false, message: error?.message ?? "Could not start conversation." },
        { status: 500 }
      );
    }

    activeConversationId = conversation.id;
  } else {
    const { data: existing } = await admin
      .from("customer_conversations")
      .select("id, status")
      .eq("id", activeConversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ ok: false, message: "Conversation not found." }, { status: 404 });
    }

    if (existing.status === "closed") {
      reopenedFromClosed = true;
      await returnTicketToQueue(admin, activeConversationId);
    } else {
      await admin
        .from("customer_conversations")
        .update({
          updated_at: now,
          customer_last_read_at: now,
        })
        .eq("id", activeConversationId);
    }
  }

  const { data: message, error: messageError } = await admin
    .from("customer_conversation_messages")
    .insert({
      conversation_id: activeConversationId,
      sender_type: "customer",
      sender_name: name,
      body: messageBody,
    })
    .select("*")
    .single();

  if (messageError || !message) {
    return NextResponse.json(
      { ok: false, message: messageError?.message ?? "Could not send message." },
      { status: 500 }
    );
  }

  const { data: conversation } = await admin
    .from("customer_conversations")
    .select("*")
    .eq("id", activeConversationId)
    .single();

  if (conversation) {
    let notifications = await createCustomerMessageNotifications(
      admin,
      message,
      conversation,
      reopenedFromClosed ? "reopened" : "new_message"
    );

    if (reopenedFromClosed) {
      const reopenedNotifications = await createTicketReopenedNotifications(
        admin,
        conversation
      );
      notifications = [...notifications, ...reopenedNotifications];
    }

    await broadcastCustomerChatRealtime(
      admin,
      message,
      conversation,
      notifications,
      "customer"
    );
  }

  return NextResponse.json({
    ok: true,
    conversationId: activeConversationId,
    message: mapCustomerMessage(message, user.id),
    reopened: reopenedFromClosed,
  });
}
