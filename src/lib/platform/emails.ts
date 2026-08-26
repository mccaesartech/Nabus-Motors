import type { SupabaseClient } from "@supabase/supabase-js";
import { platformPath } from "@/lib/platform/paths";
import { formatEmailFailureHint } from "@/lib/email/resend-constants";
import { notDeletedFilter } from "@/lib/platform/trash-types";

export const EMAIL_TEMPLATE_LABELS: Record<string, string> = {
  password_reset: "Password reset",
  preorder_submitted: "Pre-order confirmation",
  custom_request_submitted: "Custom vehicle request",
  freight_quote_submitted: "Freight quote",
  shipping_consultation_submitted: "Shipping consultation",
  quote_converted_tracking: "Shipment tracking",
  shipment_status_update: "Shipment update",
  appointment_confirmed: "Appointment confirmed",
  appointment_request_received: "Showroom visit request",
  cart_order: "Cart order",
  cart_order_confirmed: "Cart order confirmed",
  staff_new_order: "Staff new order alert",
  admin_notification: "Admin notification",
};

export type SentEmailRow = {
  id: string;
  created_at: string;
  template: string;
  status: string;
  recipient: string;
  detail: string | null;
  source_table: string | null;
  source_id: string | null;
};

export type SentEmailItem = {
  id: string;
  date: string;
  to: string;
  subject: string;
  template: string;
  templateLabel: string;
  status: string;
  detail: string | null;
  failureHint: string | null;
  link: string | null;
  linkLabel: string | null;
  sourceTable: string | null;
  sourceId: string | null;
};

export type ReceivedCommItem = {
  id: string;
  date: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  preview: string;
  type: "contact" | "vehicle_inquiry" | "customer_message";
  typeLabel: string;
  status: string | null;
  link: string;
  body: string;
  metadata?: Record<string, string | null>;
};

function humanizeTemplate(template: string): string {
  return (
    EMAIL_TEMPLATE_LABELS[template] ??
    template
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function subjectForTemplate(template: string): string {
  return humanizeTemplate(template);
}

export function sanitizeEmailDetail(detail: string | null): string | null {
  if (!detail) return null;
  return detail
    .replace(/re_[\w-]+/gi, "[resend-id]")
    .replace(/sk_[\w-]+/gi, "[api-key]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
}

export function resolveEmailSourceLink(
  sourceTable: string | null,
  sourceId: string | null
): { link: string | null; label: string | null } {
  if (!sourceTable || !sourceId) {
    return { link: null, label: null };
  }

  switch (sourceTable) {
    case "profiles":
      return { link: platformPath(`customers/${sourceId}`), label: "Customer" };
    case "preorder_inquiries":
      return { link: platformPath(`leads/preorder/${sourceId}`), label: "Pre-order" };
    case "freight_quote_requests":
      return {
        link: `${platformPath("freight/quotes")}?id=${encodeURIComponent(sourceId)}`,
        label: "Freight quote",
      };
    case "parts_orders":
      return { link: platformPath(`leads/order/${sourceId}`), label: "Order" };
    case "checkout_appointments":
    case "appointments":
      return { link: platformPath("appointments"), label: "Appointment" };
    case "freight_shipments":
      return { link: platformPath("freight/tracking"), label: "Shipment" };
    default:
      return { link: null, label: sourceTable.replace(/_/g, " ") };
  }
}

export function mapSentEmailRow(row: SentEmailRow): SentEmailItem {
  const { link, label } = resolveEmailSourceLink(row.source_table, row.source_id);
  const detail = sanitizeEmailDetail(row.detail);
  return {
    id: row.id,
    date: row.created_at,
    to: row.recipient,
    subject: subjectForTemplate(row.template),
    template: row.template,
    templateLabel: humanizeTemplate(row.template),
    status: row.status,
    detail,
    failureHint:
      row.status === "failed" || row.status === "deferred"
        ? formatEmailFailureHint(detail)
        : null,
    link,
    linkLabel: label,
    sourceTable: row.source_table,
    sourceId: row.source_id,
  };
}

type SentQueryFilters = {
  status?: string;
  template?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  id?: string;
};

export async function fetchSentEmails(
  supabase: SupabaseClient,
  filters: SentQueryFilters
): Promise<{ items: SentEmailItem[]; total: number; templates: string[] }> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const offset = (page - 1) * limit;

  if (filters.id) {
    const { data } = await supabase
      .from("notification_log")
      .select(
        "id, created_at, template, status, recipient, detail, source_table, source_id"
      )
      .eq("id", filters.id)
      .eq("channel", "email")
      .maybeSingle();

    return {
      items: data ? [mapSentEmailRow(data as SentEmailRow)] : [],
      total: data ? 1 : 0,
      templates: [],
    };
  }

  let query = supabase
    .from("notification_log")
    .select(
      "id, created_at, template, status, recipient, detail, source_table, source_id",
      { count: "exact" }
    )
    .eq("channel", "email");

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.template && filters.template !== "all") {
    query = query.eq("template", filters.template);
  }
  if (filters.from) {
    query = query.gte("created_at", filters.from);
  }
  if (filters.to) {
    query = query.lte("created_at", filters.to);
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { items: [], total: 0, templates: [] };
  }

  const { data: templateRows } = await supabase
    .from("notification_log")
    .select("template")
    .eq("channel", "email");

  const templates = Array.from(
    new Set((templateRows ?? []).map((row) => String(row.template)))
  ).sort();

  return {
    items: (data ?? []).map((row) => mapSentEmailRow(row as SentEmailRow)),
    total: count ?? 0,
    templates,
  };
}

export async function countFailedEmails(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from("notification_log")
    .select("*", { count: "exact", head: true })
    .eq("channel", "email")
    .in("status", ["failed", "deferred"]);

  return count ?? 0;
}

type ReceivedQueryFilters = {
  from?: string;
  to?: string;
  type?: string;
  page?: number;
  limit?: number;
  id?: string;
};

function receivedDateInRange(iso: string, from?: string, to?: string): boolean {
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}

export async function fetchReceivedCommunications(
  supabase: SupabaseClient,
  filters: ReceivedQueryFilters
): Promise<{ items: ReceivedCommItem[]; total: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const fetchCap = Math.min(500, page * limit);

  if (filters.id) {
    const [type, rawId] = filters.id.includes(":")
      ? filters.id.split(":", 2)
      : ["", filters.id];

    if (type === "contact") {
      const { data } = await supabase
        .from("contact_inquiries")
        .select("*")
        .eq("id", rawId)
        .maybeSingle();
      if (!data) return { items: [], total: 0 };
      const item: ReceivedCommItem = {
        id: `contact:${data.id}`,
        date: data.created_at,
        fromName: data.name,
        fromEmail: data.email,
        subject: data.subject?.trim() || "Contact form",
        preview: data.message.slice(0, 160),
        type: "contact",
        typeLabel: "Contact form",
        status: data.status,
        link: `${platformPath("leads")}?tab=contact`,
        body: data.message,
        metadata: { phone: data.phone },
      };
      return { items: [item], total: 1 };
    }

    if (type === "vehicle") {
      const { data } = await supabase
        .from("vehicle_inquiries")
        .select("*")
        .eq("id", rawId)
        .maybeSingle();
      if (!data) return { items: [], total: 0 };
      const item: ReceivedCommItem = {
        id: `vehicle:${data.id}`,
        date: data.created_at,
        fromName: data.name,
        fromEmail: data.email,
        subject: `${data.inquiry_type} — ${data.vehicle_name ?? "Vehicle inquiry"}`,
        preview: (data.message ?? "").slice(0, 160),
        type: "vehicle_inquiry",
        typeLabel: "Vehicle inquiry",
        status: data.status,
        link: `${platformPath("leads")}?tab=vehicle`,
        body: data.message ?? "",
        metadata: {
          phone: data.phone,
          vehicle: data.vehicle_name,
          inquiryType: data.inquiry_type,
        },
      };
      return { items: [item], total: 1 };
    }

    if (type === "message") {
      const { data: msg } = await supabase
        .from("customer_conversation_messages")
        .select(
          "id, body, created_at, conversation_id, sender_name, sender_type"
        )
        .eq("id", rawId)
        .eq("sender_type", "customer")
        .maybeSingle();
      if (!msg) return { items: [], total: 0 };

      const { data: conv } = await supabase
        .from("customer_conversations")
        .select("id, subject, customer_email, customer_name")
        .eq("id", msg.conversation_id)
        .maybeSingle();

      const item: ReceivedCommItem = {
        id: `message:${msg.id}`,
        date: msg.created_at,
        fromName: conv?.customer_name ?? msg.sender_name,
        fromEmail: conv?.customer_email ?? "",
        subject: conv?.subject ?? "Customer message",
        preview: msg.body.slice(0, 160),
        type: "customer_message",
        typeLabel: "Customer message",
        status: null,
        link: `${platformPath("messages")}?conversation=${encodeURIComponent(msg.conversation_id)}`,
        body: msg.body,
        metadata: { conversationId: msg.conversation_id },
      };
      return { items: [item], total: 1 };
    }

    return { items: [], total: 0 };
  }

  const merged: ReceivedCommItem[] = [];

  const includeContact = !filters.type || filters.type === "all" || filters.type === "contact";
  const includeVehicle =
    !filters.type || filters.type === "all" || filters.type === "vehicle_inquiry";
  const includeMessage =
    !filters.type || filters.type === "all" || filters.type === "customer_message";

  if (includeContact) {
    let q = notDeletedFilter(
      supabase
        .from("contact_inquiries")
        .select("id, name, email, phone, subject, message, status, created_at")
    )
      .order("created_at", { ascending: false })
      .limit(fetchCap);
    if (filters.from) q = q.gte("created_at", filters.from);
    if (filters.to) q = q.lte("created_at", filters.to);
    const { data } = await q;
    for (const row of data ?? []) {
      merged.push({
        id: `contact:${row.id}`,
        date: row.created_at,
        fromName: row.name,
        fromEmail: row.email,
        subject: row.subject?.trim() || "Contact form",
        preview: row.message.slice(0, 160),
        type: "contact",
        typeLabel: "Contact form",
        status: row.status,
        link: `${platformPath("leads")}?tab=contact`,
        body: row.message,
        metadata: { phone: row.phone },
      });
    }
  }

  if (includeVehicle) {
    let q = notDeletedFilter(
      supabase
        .from("vehicle_inquiries")
        .select(
          "id, name, email, phone, inquiry_type, vehicle_name, message, status, created_at"
        )
    )
      .order("created_at", { ascending: false })
      .limit(fetchCap);
    if (filters.from) q = q.gte("created_at", filters.from);
    if (filters.to) q = q.lte("created_at", filters.to);
    const { data } = await q;
    for (const row of data ?? []) {
      merged.push({
        id: `vehicle:${row.id}`,
        date: row.created_at,
        fromName: row.name,
        fromEmail: row.email,
        subject: `${row.inquiry_type} — ${row.vehicle_name ?? "Vehicle inquiry"}`,
        preview: (row.message ?? "").slice(0, 160),
        type: "vehicle_inquiry",
        typeLabel: "Vehicle inquiry",
        status: row.status,
        link: `${platformPath("leads")}?tab=vehicle`,
        body: row.message ?? "",
        metadata: {
          phone: row.phone,
          vehicle: row.vehicle_name,
          inquiryType: row.inquiry_type,
        },
      });
    }
  }

  if (includeMessage) {
    let q = supabase
      .from("customer_conversation_messages")
      .select(
        "id, body, created_at, conversation_id, sender_name, customer_conversations(subject, customer_email, customer_name)"
      )
      .eq("sender_type", "customer")
      .order("created_at", { ascending: false })
      .limit(fetchCap);
    if (filters.from) q = q.gte("created_at", filters.from);
    if (filters.to) q = q.lte("created_at", filters.to);
    const { data } = await q;
    for (const row of data ?? []) {
      const conv = Array.isArray(row.customer_conversations)
        ? row.customer_conversations[0]
        : row.customer_conversations;
      merged.push({
        id: `message:${row.id}`,
        date: row.created_at,
        fromName: conv?.customer_name ?? row.sender_name,
        fromEmail: conv?.customer_email ?? "",
        subject: conv?.subject ?? "Customer message",
        preview: row.body.slice(0, 160),
        type: "customer_message",
        typeLabel: "Customer message",
        status: null,
        link: `${platformPath("messages")}?conversation=${encodeURIComponent(row.conversation_id)}`,
        body: row.body,
        metadata: { conversationId: row.conversation_id },
      });
    }
  }

  const filtered = merged.filter((item) => receivedDateInRange(item.date, filters.from, filters.to));
  filtered.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const total = filtered.length;
  const offset = (page - 1) * limit;
  const items = filtered.slice(offset, offset + limit);

  return { items, total };
}
