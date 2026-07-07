export const CUSTOMER_MESSAGE_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "pre-order", label: "Pre-order" },
  { value: "financing", label: "Financing" },
  { value: "processing", label: "Processing" },
] as const;

export type CustomerMessageCategory =
  (typeof CUSTOMER_MESSAGE_CATEGORIES)[number]["value"];

export const CUSTOMER_MESSAGE_STATUSES = [
  "open",
  "claimed",
  "closed",
  "available",
] as const;

export type CustomerMessageStatus =
  (typeof CUSTOMER_MESSAGE_STATUSES)[number];

export const SUPPORT_TICKET_QUEUE_STATUSES = ["open", "available"] as const;

/** @deprecated Legacy ticket row — use CustomerConversation for threaded chat */
export type CustomerMessage = {
  id: string;
  user_id: string;
  email: string;
  name: string;
  subject: string;
  body: string;
  category: CustomerMessageCategory;
  status: CustomerMessageStatus;
  admin_reply: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerChatSenderType = "customer" | "staff";

export type CustomerChatMessage = {
  id: string;
  conversation_id: string;
  sender_type: CustomerChatSenderType;
  sender_user_id: string | null;
  sender_is_owner: boolean;
  sender_name: string;
  sender_role_label?: string;
  body: string;
  created_at: string;
  isMine: boolean;
};

export type SupportTicketAssignee = {
  user_id: string | null;
  is_owner: boolean;
  name: string | null;
  role_label?: string;
};

export type CustomerConversation = {
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
  preorder_title?: string | null;
  parts_order_id?: string | null;
  parts_order_label?: string | null;
  assigned_to: SupportTicketAssignee | null;
  claimed_at: string | null;
  closed_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  lastMessage: {
    body: string;
    created_at: string;
    sender_name: string;
    sender_type: CustomerChatSenderType;
  } | null;
  unreadCount: number;
  isAssignedToMe?: boolean;
  canReply?: boolean;
  canClaim?: boolean;
  canReassign?: boolean;
  messages?: CustomerChatMessage[];
};

export type CustomerProfileOption = {
  userId: string | null;
  email: string;
  name: string;
  registration_id: string | null;
};

export type PlatformUserOption = {
  id: string;
  name: string;
  role: string;
};

export function customerOptionValue(customer: CustomerProfileOption): string {
  return customer.userId ?? `email:${customer.email}`;
}

export function parseCustomerSelection(value: string): {
  userId?: string;
  email?: string;
} {
  if (value.startsWith("email:")) {
    return { email: value.slice(6) };
  }
  return { userId: value };
}

export type CustomRequestSpecsSummary = {
  body_type?: string;
  fuel_type?: string;
  condition?: string;
  notes?: string;
  preferred_timeline?: string;
};

export type CustomerInquirySummary = {
  id: string;
  type: "contact" | "vehicle" | "preorder" | "finance";
  title: string;
  status: string;
  created_at: string;
  down_payment_usd?: number;
  vehicle_price_usd?: number;
  payment_status?: string;
  vehicle_slug?: string;
  is_custom_request?: boolean;
  reference_code?: string;
  requested_make?: string;
  requested_model?: string;
  requested_year?: string;
  requested_specs?: CustomRequestSpecsSummary;
  budget_min?: number | null;
  budget_max?: number | null;
  matched_vehicle_id?: string | null;
  matched_vehicle_slug?: string | null;
};
