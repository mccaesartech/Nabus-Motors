import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformAuthContext } from "@/lib/admin/auth";
function displayNameFromProfile(profile: {
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
}): string {
  const fromProfile = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fromProfile) return fromProfile;
  return profile.email?.split("@")[0] ?? "Customer";
}
import {
  ensureCustomerRecordForContact,
} from "@/lib/customer/contact-account";
import type {
  CustomerChatMessage,
  CustomerConversation,
  CustomerMessageCategory,
  CustomerMessageStatus,
  CustomerProfileOption,
  PlatformUserOption,
} from "@/lib/customer/types";
import {
  aggregateCustomers,
  fetchPreorderInquiries,
} from "@/lib/platform/data";
import type { InquiryData } from "@/lib/platform/types";
import {
  ROLE_LABELS,
  canOversightCustomerTickets,
  normalizeRole,
  type PlatformRole,
} from "@/lib/platform/permissions";
import { actorIsOwner, actorRole, actorUserId } from "@/lib/platform/team-messages";
import { customerFacingStaffSenderName } from "@/lib/customer/public-branding";

type ConversationRow = {
  id: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  registration_id: string | null;
  subject: string;
  category: CustomerMessageCategory;
  status: CustomerMessageStatus;
  created_by: "customer" | "staff";
  preorder_id: string | null;
  parts_order_id: string | null;
  assigned_to_user_id: string | null;
  assigned_to_is_owner: boolean;
  claimed_at: string | null;
  closed_at: string | null;
  closed_by_user_id: string | null;
  closed_by_is_owner: boolean;
  resolution_note: string | null;
  customer_last_read_at: string | null;
  staff_last_read_at: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
};

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

export function staffHasTicketOversight(auth: PlatformAuthContext): boolean {
  return canOversightCustomerTickets(actorRole(auth));
}

export function staffCanSeeConversation(
  auth: PlatformAuthContext,
  row: Pick<
    ConversationRow,
    | "status"
    | "assigned_to_user_id"
    | "assigned_to_is_owner"
  >
): boolean {
  if (staffHasTicketOversight(auth)) return true;
  if (ticketIsInQueue(row)) return true;
  return ticketIsAssignedToActor(auth, row);
}

export function ticketIsAssignedToActor(
  auth: PlatformAuthContext,
  row: Pick<ConversationRow, "assigned_to_user_id" | "assigned_to_is_owner">
): boolean {
  if (actorIsOwner(auth)) return row.assigned_to_is_owner;
  return (
    !row.assigned_to_is_owner &&
    row.assigned_to_user_id !== null &&
    row.assigned_to_user_id === actorUserId(auth)
  );
}

export function ticketIsInQueue(
  row: Pick<ConversationRow, "status" | "assigned_to_user_id" | "assigned_to_is_owner">
): boolean {
  return (
    (row.status === "open" || row.status === "available") &&
    row.assigned_to_user_id === null &&
    !row.assigned_to_is_owner
  );
}

export function staffCanReplyToTicket(
  auth: PlatformAuthContext,
  row: ConversationRow
): boolean {
  if (row.status === "closed") return false;
  if (ticketIsInQueue(row)) return false;
  if (staffHasTicketOversight(auth)) return true;
  return ticketIsAssignedToActor(auth, row);
}

export function staffCanCloseTicket(
  auth: PlatformAuthContext,
  row: ConversationRow
): boolean {
  if (row.status === "closed") return false;
  if (staffHasTicketOversight(auth)) return !ticketIsInQueue(row);
  return staffCanReplyToTicket(auth, row);
}

export function staffCanReassignTicket(
  auth: PlatformAuthContext,
  row: ConversationRow
): boolean {
  if (row.status === "closed") return false;
  return staffHasTicketOversight(auth);
}

export function staffCanClaimTicket(
  auth: PlatformAuthContext,
  row: ConversationRow
): boolean {
  if (row.status === "closed") return false;
  return ticketIsInQueue(row);
}

async function loadAssigneeMap(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("platform_users")
    .select("id, name, role");
  const map = new Map<string, { name: string; role: PlatformRole }>();
  for (const row of data ?? []) {
    map.set(row.id, { name: row.name, role: normalizeRole(row.role) });
  }
  return map;
}

async function loadPartsOrderLabels(
  supabase: SupabaseClient,
  orderIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (orderIds.length === 0) return map;

  const { data } = await supabase
    .from("parts_orders")
    .select("id, name, total_usd, created_at")
    .in("id", orderIds);

  for (const row of data ?? []) {
    const shortId = String(row.id).slice(0, 8).toUpperCase();
    map.set(row.id, `Cart order ${shortId}`);
  }

  return map;
}

async function loadPreorderTitles(
  supabase: SupabaseClient,
  preorderIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (preorderIds.length === 0) return map;

  const { data } = await supabase
    .from("preorder_inquiries")
    .select("id, vehicle_title, vehicle:vehicles!vehicle_id(year, make, model, trim)")
    .in("id", preorderIds);

  for (const row of data ?? []) {
    const vehicle = row.vehicle as
      | { year?: number; make?: string; model?: string; trim?: string }
      | null
      | undefined;
    const fromVehicle = vehicle
      ? [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ")
      : "";
    const title =
      (row as { vehicle_title?: string | null }).vehicle_title?.trim() ||
      fromVehicle ||
      "Pre-order";
    map.set(row.id, title);
  }

  return map;
}

function mapAssignee(
  row: ConversationRow,
  assigneeMap: Map<string, { name: string; role: PlatformRole }>
): CustomerConversation["assigned_to"] {
  if (!row.assigned_to_is_owner && !row.assigned_to_user_id) return null;
  if (row.assigned_to_is_owner) {
    return {
      user_id: null,
      is_owner: true,
      name: ROLE_LABELS.owner,
      role_label: ROLE_LABELS.owner,
    };
  }
  const assignee = row.assigned_to_user_id
    ? assigneeMap.get(row.assigned_to_user_id)
    : null;
  return {
    user_id: row.assigned_to_user_id,
    is_owner: false,
    name: assignee?.name ?? "Staff",
    role_label: assignee ? ROLE_LABELS[assignee.role] : undefined,
  };
}

function mapConversationRow(
  row: ConversationRow,
  messages: MessageRow[],
  auth: PlatformAuthContext | null,
  assigneeMap: Map<string, { name: string; role: PlatformRole }>,
  preorderTitles: Map<string, string>,
  partsOrderLabels: Map<string, string>
): CustomerConversation {
  const assigned_to = mapAssignee(row, assigneeMap);
  const isAssignedToMe = auth ? ticketIsAssignedToActor(auth, row) : false;
  const canClaim = auth ? staffCanClaimTicket(auth, row) : false;
  const canReply = auth ? staffCanReplyToTicket(auth, row) : false;
  const canReassign = auth ? staffCanReassignTicket(auth, row) : false;

  return {
    id: row.id,
    user_id: row.user_id,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    registration_id: row.registration_id,
    subject: row.subject,
    category: row.category,
    status: row.status,
    created_by: row.created_by,
    preorder_id: row.preorder_id,
    preorder_title: row.preorder_id
      ? (preorderTitles.get(row.preorder_id) ?? null)
      : null,
    parts_order_id: row.parts_order_id,
    parts_order_label: row.parts_order_id
      ? (partsOrderLabels.get(row.parts_order_id) ?? null)
      : null,
    assigned_to,
    claimed_at: row.claimed_at,
    closed_at: row.closed_at,
    resolution_note: row.resolution_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
    lastMessage: lastMessageFromRows(messages),
    unreadCount: countUnreadForStaff(messages, row.staff_last_read_at),
    isAssignedToMe,
    canClaim,
    canReply,
    canReassign,
  };
}

export function messageIsFromStaffActor(
  auth: PlatformAuthContext,
  message: Pick<MessageRow, "sender_type" | "sender_is_owner" | "sender_user_id">
): boolean {
  if (message.sender_type !== "staff") return false;
  if (actorIsOwner(auth)) return message.sender_is_owner;
  return !message.sender_is_owner && message.sender_user_id === actorUserId(auth);
}

export function mapStaffMessage(
  auth: PlatformAuthContext,
  row: MessageRow,
  roleByUserId?: Map<string, PlatformRole>
): CustomerChatMessage {
  const isMine = messageIsFromStaffActor(auth, row);
  let sender_role_label: string | undefined;
  if (row.sender_is_owner) {
    sender_role_label = ROLE_LABELS.owner;
  } else if (row.sender_user_id && roleByUserId?.has(row.sender_user_id)) {
    sender_role_label = ROLE_LABELS[roleByUserId.get(row.sender_user_id)!];
  }

  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_type: row.sender_type,
    sender_user_id: row.sender_user_id,
    sender_is_owner: row.sender_is_owner,
    sender_name: row.sender_name,
    sender_role_label,
    body: row.body,
    created_at: row.created_at,
    isMine,
  };
}

export function mapCustomerMessage(
  row: MessageRow,
  customerUserId: string
): CustomerChatMessage {
  const isStaff = row.sender_type === "staff";
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_type: row.sender_type,
    // Hide internal identity from customer API payloads.
    sender_user_id: isStaff ? null : row.sender_user_id,
    sender_is_owner: false,
    sender_name: isStaff ? customerFacingStaffSenderName() : row.sender_name,
    // Never expose owner/manager/staff role labels to customers.
    sender_role_label: undefined,
    body: row.body,
    created_at: row.created_at,
    isMine: row.sender_type === "customer",
  };
}

function countUnreadForStaff(
  messages: MessageRow[],
  staffLastReadAt: string | null
): number {
  const cutoff = staffLastReadAt ? new Date(staffLastReadAt).getTime() : 0;
  return messages.filter(
    (m) =>
      m.sender_type === "customer" &&
      new Date(m.created_at).getTime() > cutoff
  ).length;
}

function countUnreadForCustomer(
  messages: MessageRow[],
  customerLastReadAt: string | null
): number {
  const cutoff = customerLastReadAt ? new Date(customerLastReadAt).getTime() : 0;
  return messages.filter(
    (m) =>
      m.sender_type === "staff" &&
      new Date(m.created_at).getTime() > cutoff
  ).length;
}

function lastMessageFromRows(messages: MessageRow[]) {
  if (messages.length === 0) return null;
  const last = messages[messages.length - 1];
  return {
    body: last.body,
    created_at: last.created_at,
    sender_name: last.sender_name,
    sender_type: last.sender_type,
  };
}

export async function loadRoleMap(supabase: SupabaseClient) {
  const { data } = await supabase.from("platform_users").select("id, role");
  const map = new Map<string, PlatformRole>();
  for (const row of data ?? []) {
    map.set(row.id, normalizeRole(row.role));
  }
  return map;
}

export async function buildConversationSummaries(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  userIdFilter?: string
): Promise<CustomerConversation[]> {
  let query = supabase
    .from("customer_conversations")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (userIdFilter) {
    query = query.eq("user_id", userIdFilter);
  }

  let { data: conversations, error } = await query;

  // Graceful fallback when migration 079 (deleted_at) is not applied yet.
  if (error && /deleted_at/i.test(error.message)) {
    const { reportSchemaIssue } = await import("@/lib/observability/schema-issue");
    reportSchemaIssue({
      table: "customer_conversations",
      column: "deleted_at",
      migration: "079_support_ticket_soft_delete.sql",
      source: "conversations-server.list",
      message: error.message,
    });
    let fallback = supabase
      .from("customer_conversations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (userIdFilter) {
      fallback = fallback.eq("user_id", userIdFilter);
    }
    const retry = await fallback;
    conversations = retry.data;
    error = retry.error;
  }

  if (error || !conversations?.length) return [];

  const rows = conversations as ConversationRow[];
  const ids = rows.map((c) => c.id);
  const preorderIds = rows
    .map((c) => c.preorder_id)
    .filter((id): id is string => Boolean(id));
  const partsOrderIds = rows
    .map((c) => c.parts_order_id)
    .filter((id): id is string => Boolean(id));

  const [allMessagesRes, assigneeMap, preorderTitles, partsOrderLabels] = await Promise.all([
    supabase
      .from("customer_conversation_messages")
      .select("*")
      .in("conversation_id", ids)
      .order("created_at", { ascending: true }),
    loadAssigneeMap(supabase),
    loadPreorderTitles(supabase, preorderIds),
    loadPartsOrderLabels(supabase, partsOrderIds),
  ]);

  const messagesByConversation = new Map<string, MessageRow[]>();
  for (const msg of (allMessagesRes.data ?? []) as MessageRow[]) {
    const list = messagesByConversation.get(msg.conversation_id) ?? [];
    list.push(msg);
    messagesByConversation.set(msg.conversation_id, list);
  }

  return rows
    .filter((row) => staffCanSeeConversation(auth, row))
    .map((row) =>
    mapConversationRow(
      row,
      messagesByConversation.get(row.id) ?? [],
      auth,
      assigneeMap,
      preorderTitles,
      partsOrderLabels
    )
  );
}

export async function buildCustomerConversationSummaries(
  supabase: SupabaseClient,
  customerUserId: string
): Promise<CustomerConversation[]> {
  let { data: conversations, error } = await supabase
    .from("customer_conversations")
    .select("*")
    .eq("user_id", customerUserId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error && /deleted_at/i.test(error.message)) {
    const retry = await supabase
      .from("customer_conversations")
      .select("*")
      .eq("user_id", customerUserId)
      .order("updated_at", { ascending: false });
    conversations = retry.data;
    error = retry.error;
  }

  if (error || !conversations?.length) return [];

  const rows = conversations as ConversationRow[];
  const ids = rows.map((c) => c.id);
  const preorderIds = rows
    .map((c) => c.preorder_id)
    .filter((id): id is string => Boolean(id));
  const partsOrderIds = rows
    .map((c) => c.parts_order_id)
    .filter((id): id is string => Boolean(id));

  const [allMessagesRes, assigneeMap, preorderTitles, partsOrderLabels] = await Promise.all([
    supabase
      .from("customer_conversation_messages")
      .select("*")
      .in("conversation_id", ids)
      .order("created_at", { ascending: true }),
    loadAssigneeMap(supabase),
    loadPreorderTitles(supabase, preorderIds),
    loadPartsOrderLabels(supabase, partsOrderIds),
  ]);

  const messagesByConversation = new Map<string, MessageRow[]>();
  for (const msg of (allMessagesRes.data ?? []) as MessageRow[]) {
    const list = messagesByConversation.get(msg.conversation_id) ?? [];
    list.push(msg);
    messagesByConversation.set(msg.conversation_id, list);
  }

  return rows.map((row) => {
    const messages = messagesByConversation.get(row.id) ?? [];
    const base = mapConversationRow(
      row,
      messages,
      null,
      assigneeMap,
      preorderTitles,
      partsOrderLabels
    );
    return {
      ...base,
      unreadCount: countUnreadForCustomer(messages, row.customer_last_read_at),
    };
  });
}

export async function getConversationRow(
  supabase: SupabaseClient,
  conversationId: string
): Promise<ConversationRow | null> {
  const { data } = await supabase
    .from("customer_conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();
  const row = (data as ConversationRow | null) ?? null;
  if (row?.deleted_at) return null;
  return row;
}

export async function claimSupportTicket(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  ticketId: string
): Promise<{ conversation: ConversationRow } | { error: string }> {
  const existing = await getConversationRow(supabase, ticketId);
  if (!existing) return { error: "Ticket not found." };
  if (!staffCanClaimTicket(auth, existing)) {
    return { error: "This ticket is no longer available to accept." };
  }

  const { data, error } = await supabase.rpc("claim_support_ticket", {
    p_ticket_id: ticketId,
    p_claimer_user_id: actorUserId(auth),
    p_claimer_is_owner: actorIsOwner(auth),
  });

  const claimed = (data as ConversationRow[] | null)?.[0];
  if (error || !claimed) {
    return { error: "Another team member accepted this ticket first." };
  }

  return { conversation: claimed };
}

export async function closeSupportTicket(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  ticketId: string,
  resolutionNote?: string
): Promise<{ conversation: ConversationRow } | { error: string }> {
  const existing = await getConversationRow(supabase, ticketId);
  if (!existing) return { error: "Ticket not found." };
  if (!staffCanCloseTicket(auth, existing)) {
    return { error: "Only the assigned agent can close this ticket." };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("customer_conversations")
    .update({
      status: "closed",
      closed_at: now,
      closed_by_user_id: actorIsOwner(auth) ? null : actorUserId(auth),
      closed_by_is_owner: actorIsOwner(auth),
      resolution_note: resolutionNote?.trim() || null,
      updated_at: now,
    })
    .eq("id", ticketId)
    .select("*")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not close ticket." };
  }

  return { conversation: data as ConversationRow };
}

export async function reopenSupportTicketForCustomer(
  supabase: SupabaseClient,
  ticketId: string,
  customerUserId: string
): Promise<{ conversation: ConversationRow } | { error: string }> {
  const existing = await getConversationRow(supabase, ticketId);
  if (!existing || existing.user_id !== customerUserId) {
    return { error: "Ticket not found." };
  }
  if (existing.status !== "closed") {
    return { error: "Only closed tickets can be reopened." };
  }

  const { data, error } = await supabase.rpc("reopen_support_ticket", {
    p_ticket_id: ticketId,
  });

  const reopened = (data as ConversationRow[] | null)?.[0];
  if (error || !reopened) {
    return { error: error?.message ?? "Could not reopen ticket." };
  }

  return { conversation: reopened };
}

export async function reassignSupportTicket(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  ticketId: string,
  assigneeUserId: string | null,
  assigneeIsOwner: boolean
): Promise<{ conversation: ConversationRow } | { error: string }> {
  const existing = await getConversationRow(supabase, ticketId);
  if (!existing) return { error: "Ticket not found." };
  if (!staffCanReassignTicket(auth, existing)) {
    return { error: "You do not have permission to reassign this ticket." };
  }

  const hasAssignee = assigneeIsOwner || Boolean(assigneeUserId);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("customer_conversations")
    .update({
      status: hasAssignee ? "claimed" : "available",
      assigned_to_user_id: assigneeIsOwner ? null : assigneeUserId,
      assigned_to_is_owner: assigneeIsOwner,
      claimed_at: hasAssignee ? now : null,
      updated_at: now,
    })
    .eq("id", ticketId)
    .select("*")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not reassign ticket." };
  }

  return { conversation: data as ConversationRow };
}

export async function returnTicketToQueue(
  supabase: SupabaseClient,
  ticketId: string
): Promise<ConversationRow | null> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("customer_conversations")
    .update({
      status: "available",
      assigned_to_user_id: null,
      assigned_to_is_owner: false,
      claimed_at: null,
      closed_at: null,
      closed_by_user_id: null,
      closed_by_is_owner: false,
      resolution_note: null,
      updated_at: now,
    })
    .eq("id", ticketId)
    .select("*")
    .maybeSingle();

  return (data as ConversationRow | null) ?? null;
}

export async function loadConversationMessagesForStaff(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  conversationId: string
): Promise<CustomerChatMessage[] | { error: string }> {
  const conversation = await getConversationRow(supabase, conversationId);
  if (!conversation) return { error: "Conversation not found." };
  if (!staffCanSeeConversation(auth, conversation)) {
    return { error: "You do not have access to this conversation." };
  }

  const roleMap = await loadRoleMap(supabase);
  const { data, error } = await supabase
    .from("customer_conversation_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) return [];

  const now = new Date().toISOString();
  await supabase
    .from("customer_conversations")
    .update({ staff_last_read_at: now })
    .eq("id", conversationId);

  return ((data ?? []) as MessageRow[]).map((row) =>
    mapStaffMessage(auth, row, roleMap)
  );
}

export async function listPlatformUsersForAssignment(
  supabase: SupabaseClient
): Promise<PlatformUserOption[]> {
  const { data } = await supabase
    .from("platform_users")
    .select("id, name, role")
    .eq("status", "active")
    .order("name", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    role: normalizeRole(row.role),
  }));
}

export async function loadConversationMessagesForCustomer(
  supabase: SupabaseClient,
  customerUserId: string,
  conversationId: string
): Promise<CustomerChatMessage[]> {
  const { data, error } = await supabase
    .from("customer_conversation_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) return [];

  const now = new Date().toISOString();
  await supabase
    .from("customer_conversations")
    .update({ customer_last_read_at: now })
    .eq("id", conversationId)
    .eq("user_id", customerUserId);

  return ((data ?? []) as MessageRow[]).map((row) =>
    mapCustomerMessage(row, customerUserId)
  );
}

async function fetchInquiryDataForCustomers(
  supabase: SupabaseClient
): Promise<InquiryData> {
  const fetchTable = async (table: string, order = "created_at") => {
    const { data } = await supabase
      .from(table)
      .select("*")
      .order(order, { ascending: false })
      .limit(100);
    return data ?? [];
  };

  const [contact, finance, appraisal, vehicle, preorder, partsOrders] = await Promise.all([
    fetchTable("contact_inquiries"),
    fetchTable("finance_applications"),
    fetchTable("appraisal_requests"),
    fetchTable("vehicle_inquiries"),
    fetchPreorderInquiries(supabase),
    fetchTable("parts_orders"),
  ]);

  return {
    contact,
    finance,
    appraisal,
    vehicle,
    preorder,
    order: partsOrders,
    newsletter: [],
  };
}

export async function listSelectableCustomers(
  supabase: SupabaseClient
): Promise<CustomerProfileOption[]> {
  const [profilesResult, inquiryData] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, first_name, last_name, registration_id")
      .not("email", "is", null)
      .neq("email", ""),
    fetchInquiryDataForCustomers(supabase),
  ]);

  const profiles = profilesResult.data ?? [];
  const profileByEmail = new Map<
    string,
    {
      id: string;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      registration_id: string | null;
    }
  >();

  for (const profile of profiles) {
    const email = profile.email?.trim().toLowerCase();
    if (email) profileByEmail.set(email, profile);
  }

  const aggregated = aggregateCustomers(inquiryData, profiles);
  const byEmail = new Map<string, CustomerProfileOption>();

  for (const customer of aggregated) {
    const email = customer.email.trim().toLowerCase();
    if (!email) continue;

    const profile = profileByEmail.get(email);
    byEmail.set(email, {
      userId: profile?.id ?? null,
      email: customer.email,
      name: customer.name,
      registration_id:
        customer.registrationId ?? profile?.registration_id ?? null,
    });
  }

  for (const profile of profiles) {
    const email = profile.email?.trim().toLowerCase();
    if (!email || byEmail.has(email)) continue;

    byEmail.set(email, {
      userId: profile.id,
      email: profile.email ?? email,
      name: displayNameFromProfile({
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email ?? email,
      }),
      registration_id: profile.registration_id ?? null,
    });
  }

  return Array.from(byEmail.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

/** @deprecated Use listSelectableCustomers */
export async function listRegisteredCustomers(supabase: SupabaseClient) {
  return listSelectableCustomers(supabase);
}

export type InsertStaffMessageResult = {
  conversation: ConversationRow;
  message: MessageRow;
  isNewConversation: boolean;
};

export async function insertStaffMessage(
  supabase: SupabaseClient,
  auth: PlatformAuthContext,
  opts: {
    conversationId?: string;
    userId?: string;
    email?: string;
    name?: string;
    phone?: string;
    subject?: string;
    category?: CustomerMessageCategory;
    partsOrderId?: string;
    assignToUserId?: string;
    assignToIsOwner?: boolean;
    assignToUnassigned?: boolean;
    body: string;
  }
): Promise<InsertStaffMessageResult | { error: string }> {
  const text = opts.body.trim();
  if (!text) return { error: "Message body is required." };

  let conversationId = opts.conversationId;
  let conversation: ConversationRow | null = null;
  let isNewConversation = false;

  if (conversationId) {
    const { data } = await supabase
      .from("customer_conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle();
    conversation = (data as ConversationRow | null) ?? null;
    if (!conversation || conversation.deleted_at) {
      return { error: "Conversation not found." };
    }
    if (!staffCanReplyToTicket(auth, conversation)) {
      return {
        error: conversation.status === "closed"
          ? "This ticket is closed. The customer must reopen it before you can reply."
          : "Accept this ticket before replying.",
      };
    }
  } else {
    const customer = await ensureCustomerRecordForContact({
      userId: opts.userId,
      email: opts.email,
      name: opts.name,
      phone: opts.phone,
    });
    if (!customer) {
      return {
        error:
          "Customer not found. Choose a customer with a valid email from the list.",
      };
    }

    const subject = (opts.subject ?? "Message from True Goshen Auto").trim();
    const category = opts.category ?? "general";
    const now = new Date().toISOString();

    let assignToUserId: string | null = actorIsOwner(auth) ? null : actorUserId(auth);
    let assignToIsOwner = actorIsOwner(auth);

    if (staffHasTicketOversight(auth) && opts.assignToUnassigned) {
      assignToUserId = null;
      assignToIsOwner = false;
    } else if (staffHasTicketOversight(auth) && opts.assignToIsOwner) {
      assignToUserId = null;
      assignToIsOwner = true;
    } else if (staffHasTicketOversight(auth) && opts.assignToUserId) {
      assignToUserId = opts.assignToUserId;
      assignToIsOwner = false;
    }

    const insertPayload: Record<string, unknown> = {
      user_id: customer.userId,
      customer_name: customer.name,
      customer_email: customer.email,
      registration_id: customer.registration_id,
      subject,
      category,
      status: assignToUserId || assignToIsOwner ? "claimed" : "available",
      created_by: "staff",
      parts_order_id: opts.partsOrderId ?? null,
      assigned_to_user_id: assignToIsOwner ? null : assignToUserId,
      assigned_to_is_owner: assignToIsOwner,
      claimed_at: assignToUserId || assignToIsOwner ? now : null,
      staff_last_read_at: now,
    };

    let { data, error } = await supabase
      .from("customer_conversations")
      .insert(insertPayload)
      .select("*")
      .single();

    if (
      error &&
      opts.partsOrderId &&
      (error.message.includes("parts_order_id") || error.message.includes("column"))
    ) {
      const { parts_order_id: _drop, ...withoutOrder } = insertPayload;
      ({ data, error } = await supabase
        .from("customer_conversations")
        .insert(withoutOrder)
        .select("*")
        .single());
    }

    if (error || !data) return { error: error?.message ?? "Could not start conversation." };
    conversation = data as ConversationRow;
    conversationId = conversation.id;
    isNewConversation = true;
  }

  const now = new Date().toISOString();
  const { data: message, error: messageError } = await supabase
    .from("customer_conversation_messages")
    .insert({
      conversation_id: conversationId,
      sender_type: "staff",
      sender_user_id: actorIsOwner(auth) ? null : actorUserId(auth),
      sender_is_owner: actorIsOwner(auth),
      sender_name: auth.name,
      body: text,
    })
    .select("*")
    .single();

  if (messageError || !message) {
    return { error: messageError?.message ?? "Could not send message." };
  }

  await supabase
    .from("customer_conversations")
    .update({
      updated_at: now,
      staff_last_read_at: now,
      status: conversation!.status === "closed" ? "claimed" : "claimed",
    })
    .eq("id", conversationId);

  const { data: refreshed } = await supabase
    .from("customer_conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  return {
    conversation: (refreshed as ConversationRow) ?? conversation!,
    message: message as MessageRow,
    isNewConversation,
  };
}
