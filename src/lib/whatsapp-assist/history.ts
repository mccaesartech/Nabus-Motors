import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import {
  isMissingRelationError,
  isSchemaMissing,
  markSchemaMissing,
  markSchemaPresent,
  SCHEMA_CAPS,
} from "@/lib/observability/schema-capability";
import { toWhatsAppE164 } from "@/lib/notifications/phone";
import type { WhatsAppConversationTurn } from "@/lib/whatsapp-assist/types";

const STAFF_WHATSAPP_TABLE = "staff_whatsapp_messages";

export async function loadStaffWhatsAppHistory(
  supabase: SupabaseClient,
  phone: string,
  limit = 20
): Promise<WhatsAppConversationTurn[]> {
  if (isSchemaMissing(SCHEMA_CAPS.staffWhatsappMessages)) return [];

  const e164 = toWhatsAppE164(phone);
  const digits = e164.replace(/\D/g, "");
  if (!digits) return [];

  try {
    const { data, error } = await supabase
      .from(STAFF_WHATSAPP_TABLE)
      .select("body, created_at, staff_name, direction")
      .or(`customer_phone.eq.${phone},customer_phone.ilike.%${digits.slice(-9)}%`)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingRelationError(error.message, STAFF_WHATSAPP_TABLE)) {
        markSchemaMissing(SCHEMA_CAPS.staffWhatsappMessages);
        return [];
      }
      return [];
    }

    markSchemaPresent(SCHEMA_CAPS.staffWhatsappMessages);
    return (data ?? [])
      .map((row) => ({
        role: "staff" as const,
        body: String(row.body ?? "").trim(),
        at: row.created_at ? String(row.created_at) : null,
        source: "staff_whatsapp_messages",
      }))
      .filter((row) => row.body.length > 0)
      .reverse();
  } catch {
    return [];
  }
}

type NotificationLogRow = {
  template: string;
  status: string;
  detail: string | null;
  created_at: string;
};

function parseNotificationDetail(detail: string | null): string | null {
  if (!detail?.trim()) return null;
  try {
    const parsed = JSON.parse(detail) as { waMeText?: string; reason?: string };
    if (parsed.waMeText?.trim()) return parsed.waMeText.trim();
    if (parsed.reason?.trim()) return parsed.reason.trim();
  } catch {
    // plain text detail
  }
  return detail.trim().slice(0, 500) || null;
}

export async function loadAutomatedWhatsAppHistory(
  supabase: SupabaseClient,
  phone: string,
  limit = 15
): Promise<WhatsAppConversationTurn[]> {
  const e164 = toWhatsAppE164(phone);
  if (!e164) return [];

  try {
    const { data } = await supabase
      .from("notification_log")
      .select("template, status, detail, created_at")
      .eq("channel", "whatsapp")
      .or(`recipient.eq.${phone},recipient.eq.${e164},recipient.ilike.%${e164.replace("+", "")}%`)
      .order("created_at", { ascending: false })
      .limit(limit);

    const rows = (data ?? []) as NotificationLogRow[];
    return rows
      .map((row) => {
        const body = parseNotificationDetail(row.detail);
        if (!body) return null;
        return {
          role: "system" as const,
          body: `[${row.template}] ${body}`,
          at: row.created_at,
          source: "notification_log",
        };
      })
      .filter((row): row is WhatsAppConversationTurn => row !== null)
      .reverse();
  } catch {
    return [];
  }
}

export async function loadPlatformMessageHistory(
  supabase: SupabaseClient,
  userId: string | null,
  email: string | null,
  limit = 15
): Promise<WhatsAppConversationTurn[]> {
  if (!userId && !email?.trim()) return [];

  try {
    let conversationQuery = supabase
      .from("customer_conversations")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(5);

    if (userId) {
      conversationQuery = conversationQuery.eq("user_id", userId);
    } else if (email) {
      conversationQuery = conversationQuery.ilike("customer_email", email.trim());
    }

    const { data: conversations } = await conversationQuery;
    const ids = (conversations ?? []).map((c) => String(c.id));
    if (ids.length === 0) return [];

    const { data: messages } = await supabase
      .from("customer_conversation_messages")
      .select("body, sender_type, created_at, sender_name")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(limit);

    return (messages ?? [])
      .map((row) => ({
        role: row.sender_type === "customer" ? ("customer" as const) : ("staff" as const),
        body: String(row.body ?? "").trim(),
        at: row.created_at ? String(row.created_at) : null,
        source: `platform_messages:${row.sender_name ?? "staff"}`,
      }))
      .filter((row) => row.body.length > 0)
      .reverse();
  } catch {
    return [];
  }
}

export async function recordStaffWhatsAppSend(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  row: {
    phone: string;
    body: string;
    userId?: string | null;
    email?: string | null;
    contextType?: string | null;
    contextId?: string | null;
    sendMethod: "api" | "wa_me";
    providerMessageId?: string | null;
  }
): Promise<string | null> {
  if (isSchemaMissing(SCHEMA_CAPS.staffWhatsappMessages)) return null;

  try {
    const { data, error } = await supabase
      .from(STAFF_WHATSAPP_TABLE)
      .insert({
        customer_user_id: row.userId ?? null,
        customer_email: row.email?.trim().toLowerCase() ?? null,
        customer_phone: row.phone,
        direction: "outbound",
        body: row.body,
        staff_user_id: auth.type === "user" ? auth.userId ?? null : null,
        staff_is_owner: auth.type === "owner",
        staff_name: auth.name,
        context_type: row.contextType ?? null,
        context_id: row.contextId ?? null,
        send_method: row.sendMethod,
        provider_message_id: row.providerMessageId ?? null,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error.message, STAFF_WHATSAPP_TABLE)) {
        markSchemaMissing(SCHEMA_CAPS.staffWhatsappMessages);
        return null;
      }
      console.warn("[whatsapp-assist] history insert failed:", error.message);
      return null;
    }

    markSchemaPresent(SCHEMA_CAPS.staffWhatsappMessages);
    return data?.id ?? null;
  } catch {
    return null;
  }
}

export function mergeConversationHistory(
  ...sources: WhatsAppConversationTurn[][]
): WhatsAppConversationTurn[] {
  const merged = sources.flat().filter((turn) => turn.body.trim().length > 0);
  merged.sort((a, b) => {
    const ta = a.at ? Date.parse(a.at) : 0;
    const tb = b.at ? Date.parse(b.at) : 0;
    return ta - tb;
  });
  return merged.slice(-30);
}
