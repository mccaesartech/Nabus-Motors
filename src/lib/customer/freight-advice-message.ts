import type { SupabaseClient, User } from "@supabase/supabase-js";
import { customerDisplayName } from "@/lib/customer/auth";
import { ensureCustomerRecordForContact } from "@/lib/customer/contact-account";
import type { CustomerMessageCategory } from "@/lib/customer/types";
import {
  broadcastCustomerChatRealtime,
  createCustomerMessageNotifications,
} from "@/lib/platform/customer-chat-notifications";

export type FreightAdviceContext = {
  trackingNumber?: string | null;
  referenceCode?: string | null;
};

function buildSubject(context: FreightAdviceContext): string {
  if (context.trackingNumber) {
    return `Shipment question — ${context.trackingNumber}`;
  }
  if (context.referenceCode) {
    return `Freight advice — ${context.referenceCode}`;
  }
  return "Freight advice";
}

function appendContextToBody(body: string, context: FreightAdviceContext): string {
  const lines: string[] = [body.trim()];
  if (context.trackingNumber) {
    lines.push("", `Tracking number: ${context.trackingNumber}`);
  }
  if (context.referenceCode) {
    lines.push("", `Quote reference: ${context.referenceCode}`);
  }
  return lines.join("\n");
}

export type SendFreightAdviceMessageInput = {
  userId?: string;
  name?: string;
  email?: string;
  phone?: string;
  body: string;
  context?: FreightAdviceContext;
  category?: CustomerMessageCategory;
};

export type SendFreightAdviceMessageResult =
  | {
      ok: true;
      conversationId: string;
      messageId: string;
      userId: string;
    }
  | { ok: false; error: string; status?: number };

export async function sendFreightAdviceMessage(
  supabase: SupabaseClient,
  input: SendFreightAdviceMessageInput
): Promise<SendFreightAdviceMessageResult> {
  const messageBody = input.body.trim();
  if (!messageBody) {
    return { ok: false, error: "Message is required.", status: 400 };
  }

  const context = input.context ?? {};
  const subject = buildSubject(context);
  const fullBody = appendContextToBody(messageBody, context);
  const category = input.category ?? "processing";

  let userId = input.userId;
  let customerName = input.name?.trim() ?? "";
  let customerEmail = input.email?.trim() ?? "";
  let registrationId: string | null = null;

  if (!userId) {
    if (!customerEmail) {
      return { ok: false, error: "Email is required.", status: 400 };
    }
    if (!customerName) {
      return { ok: false, error: "Name is required.", status: 400 };
    }

    const customer = await ensureCustomerRecordForContact({
      email: customerEmail,
      name: customerName,
      phone: input.phone,
    });

    if (!customer) {
      return {
        ok: false,
        error: "Could not start your message. Please try again or contact us directly.",
        status: 500,
      };
    }

    userId = customer.userId;
    customerName = customer.name;
    customerEmail = customer.email;
    registrationId = customer.registration_id;
  } else {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, phone, registration_id, email")
      .eq("id", userId)
      .maybeSingle();

    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    customerEmail = profile?.email ?? authUser?.user?.email ?? customerEmail;
    if (!customerEmail) {
      return { ok: false, error: "Account email not found.", status: 400 };
    }

    customerName = customerDisplayName(
      profile
        ? {
            id: userId,
            first_name: profile.first_name,
            last_name: profile.last_name,
            phone: profile.phone,
            registration_id: profile.registration_id,
          }
        : null,
      (authUser?.user ?? { id: userId, email: customerEmail }) as User
    );
    registrationId = profile?.registration_id ?? null;
  }

  const now = new Date().toISOString();

  const { data: conversation, error: conversationError } = await supabase
    .from("customer_conversations")
    .insert({
      user_id: userId,
      customer_name: customerName,
      customer_email: customerEmail,
      registration_id: registrationId,
      subject,
      category,
      status: "open",
      created_by: "customer",
      customer_last_read_at: now,
    })
    .select("*")
    .single();

  if (conversationError || !conversation) {
    return {
      ok: false,
      error: conversationError?.message ?? "Could not start conversation.",
      status: 500,
    };
  }

  const { data: message, error: messageError } = await supabase
    .from("customer_conversation_messages")
    .insert({
      conversation_id: conversation.id,
      sender_type: "customer",
      sender_name: customerName,
      body: fullBody,
    })
    .select("*")
    .single();

  if (messageError || !message) {
    return {
      ok: false,
      error: messageError?.message ?? "Could not send message.",
      status: 500,
    };
  }

  const notifications = await createCustomerMessageNotifications(
    supabase,
    message,
    conversation,
    "new_message"
  );

  await broadcastCustomerChatRealtime(
    supabase,
    message,
    conversation,
    notifications,
    "customer"
  );

  return {
    ok: true,
    conversationId: conversation.id,
    messageId: message.id,
    userId,
  };
}
