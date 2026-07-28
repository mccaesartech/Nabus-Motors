export const TRASH_ENTITY_TYPES = [
  "expense",
  "sale",
  "order",
  "vehicle",
  "customer",
  "platform_user",
  "lead_contact",
  "lead_finance",
  "lead_appraisal",
  "lead_vehicle",
  "preorder",
  "support_ticket",
  "admin_notification",
] as const;

export type TrashEntityType = (typeof TRASH_ENTITY_TYPES)[number];

export const TRASH_ENTITY_LABELS: Record<TrashEntityType, string> = {
  expense: "Expense",
  sale: "Sale",
  order: "Cart order",
  vehicle: "Vehicle",
  customer: "Customer",
  platform_user: "Team user",
  lead_contact: "Contact inquiry",
  lead_finance: "Finance application",
  lead_appraisal: "Appraisal request",
  lead_vehicle: "Vehicle inquiry",
  preorder: "Pre-order",
  support_ticket: "Support ticket",
  admin_notification: "Notification",
};

export const INQUIRY_TRASH_TYPES: Record<string, TrashEntityType> = {
  contact: "lead_contact",
  finance: "lead_finance",
  appraisal: "lead_appraisal",
  vehicle: "lead_vehicle",
  preorder: "preorder",
  order: "order",
};

export type PlatformTrashRow = {
  id: string;
  entity_type: TrashEntityType;
  entity_id: string;
  entity_label: string;
  snapshot: Record<string, unknown>;
  deleted_at: string;
  deleted_by_user_id: string | null;
  deleted_by_name: string | null;
  deleted_by_email: string | null;
  restored_at: string | null;
  permanently_deleted_at: string | null;
};

/** Supabase filter helper — hide soft-deleted rows when column exists. */
export function notDeletedFilter<T extends { is: (col: string, val: null) => T }>(query: T): T {
  return query.is("deleted_at", null);
}
