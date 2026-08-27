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
  "document",
  "part",
  "part_category",
  "shipment",
  "freight_quote",
  "appointment",
  "sent_email",
  "audit_log",
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
  document: "Document",
  part: "Spare part",
  part_category: "Parts category",
  shipment: "Shipment",
  freight_quote: "Freight quote",
  appointment: "Appointment",
  sent_email: "Sent email log",
  audit_log: "Audit log entry",
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

/** Sanitize user search for PostgREST `.or()` / `.ilike` filter strings. */
export function sanitizeTrashSearchTerm(raw: string): string {
  return raw
    .trim()
    .replace(/[%_,.()"'\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * Build a PostgREST `or` filter that matches trash rows by label, id, or
 * common snapshot fields (vehicles: make/model/VIN/slug/year; orders/leads: name/email).
 */
export function buildTrashSearchOrFilter(q: string): string | null {
  const term = sanitizeTrashSearchTerm(q);
  if (!term) return null;
  const pattern = `%${term}%`;
  const columns = [
    "entity_label",
    "entity_id",
    "snapshot->>make",
    "snapshot->>model",
    "snapshot->>vin",
    "snapshot->>slug",
    "snapshot->>name",
    "snapshot->>email",
    "snapshot->>title",
    "snapshot->>year",
  ] as const;
  // Quote patterns so spaces in the term do not break PostgREST `.or()` parsing.
  return columns.map((col) => `${col}.ilike."${pattern}"`).join(",");
}

/** Supabase filter helper — hide soft-deleted rows when column exists. */
export function notDeletedFilter<T extends { is: (col: string, val: null) => T }>(query: T): T {
  return query.is("deleted_at", null);
}
