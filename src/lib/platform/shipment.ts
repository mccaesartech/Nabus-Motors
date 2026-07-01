export const SHIPMENT_STATUSES = [
  "pending",
  "booked",
  "in_transit",
  "at_port",
  "clearing",
  "delivered",
  "cancelled",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_REFERENCE_TYPES = ["preorder", "freight", "parts", "other"] as const;

export type ShipmentReferenceType = (typeof SHIPMENT_REFERENCE_TYPES)[number];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending: "Pending",
  booked: "Booked",
  in_transit: "In transit",
  at_port: "At port",
  clearing: "Clearing customs",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const FREIGHT_QUOTE_STATUSES = [
  "new",
  "contacted",
  "quoted",
  "accepted",
  "converted",
  "closed",
  "cancelled",
] as const;

export type FreightQuoteStatus = (typeof FREIGHT_QUOTE_STATUSES)[number];

export const FREIGHT_QUOTE_STATUS_LABELS: Record<FreightQuoteStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  accepted: "Accepted",
  converted: "Converted",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const FREIGHT_SERVICE_TYPES = [
  "vehicle_shipping",
  "container_shipping",
  "documentation",
  "clearing",
  "other",
] as const;

export type ShipmentTrackingRow = {
  id: string;
  tracking_number: string;
  reference_type: ShipmentReferenceType;
  reference_id: string | null;
  user_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  whatsapp_opt_in: boolean | null;
  origin_country: string | null;
  destination: string | null;
  vessel_name: string | null;
  container_number: string | null;
  status: ShipmentStatus;
  estimated_arrival: string | null;
  actual_arrival: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ShipmentTimelineEventRow = {
  id: string;
  shipment_id: string;
  event_type: string;
  title: string;
  description: string | null;
  location: string | null;
  event_at: string;
  is_customer_visible: boolean;
  created_at: string;
};

export type ShipmentWithEvents = ShipmentTrackingRow & {
  events: ShipmentTimelineEventRow[];
};

export function shipmentStatusLabel(status: string): string {
  return SHIPMENT_STATUS_LABELS[status as ShipmentStatus] ?? status;
}

/** Visual progress bar steps (excludes cancelled). */
export const SHIPMENT_VISUAL_STEPS = [
  { status: "pending", label: "Order Confirmed" },
  { status: "booked", label: "Booked" },
  { status: "in_transit", label: "In Transit" },
  { status: "at_port", label: "At Port" },
  { status: "clearing", label: "Cleared" },
  { status: "delivered", label: "Delivered" },
] as const;

export const QUOTE_VISUAL_STEPS = [
  { status: "new", label: "Submitted" },
  { status: "contacted", label: "Reviewing" },
  { status: "quoted", label: "Quote Ready" },
  { status: "converted", label: "Converted" },
] as const;

const SHIPMENT_STATUS_STEP_INDEX: Record<string, number> = {
  pending: 0,
  booked: 1,
  in_transit: 2,
  at_port: 3,
  clearing: 4,
  delivered: 5,
  cancelled: -1,
};

const QUOTE_STATUS_STEP_INDEX: Record<string, number> = {
  new: 0,
  contacted: 1,
  quoted: 2,
  accepted: 2,
  converted: 3,
  closed: 3,
  cancelled: -1,
};

export function shipmentStatusStepIndex(status: string): number {
  return SHIPMENT_STATUS_STEP_INDEX[status] ?? 0;
}

export function quoteStatusStepIndex(status: string): number {
  return QUOTE_STATUS_STEP_INDEX[status] ?? 0;
}

export function isTerminalShipmentStatus(status: string): boolean {
  return status === "delivered" || status === "cancelled";
}

export function isTerminalQuoteStatus(status: string): boolean {
  return status === "converted" || status === "closed" || status === "cancelled";
}

export function generateTrackingNumber(): string {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TG-${year}-${suffix}`;
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  return na === nb || na.endsWith(nb) || nb.endsWith(na);
}

export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
