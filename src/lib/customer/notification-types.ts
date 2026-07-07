import { ROUTES } from "@/lib/routes";

export type CustomerNotificationType =
  | "order_submitted"
  | "order_confirmed"
  | "order_status"
  | "preorder_update"
  | "custom_request_submitted"
  | "custom_request_update"
  | "appointment_confirmed"
  | "staff_message"
  | "shipment_update";

export type CustomerNotification = {
  id: string;
  type: CustomerNotificationType | string;
  title: string;
  body: string;
  link: string | null;
  sourceTable: string | null;
  sourceId: string | null;
  readAt: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export function accountOrderLink(orderId?: string): string {
  if (orderId) return `${ROUTES.corporate.account}?section=orders&order=${orderId}`;
  return `${ROUTES.corporate.account}#my-orders`;
}

export function accountPreorderLink(preorderId?: string): string {
  if (preorderId) return `${ROUTES.corporate.account}?section=preorders&preorder=${preorderId}`;
  return `${ROUTES.corporate.account}#my-preorders`;
}

export function accountVehicleRequestLink(requestId?: string): string {
  if (requestId) {
    return `${ROUTES.corporate.account}?section=vehicle-requests&request=${requestId}`;
  }
  return `${ROUTES.corporate.account}#vehicle-requests`;
}

export function accountMessagesLink(conversationId?: string): string {
  if (conversationId) {
    return `${ROUTES.corporate.account}?conversation=${encodeURIComponent(conversationId)}#messages`;
  }
  return `${ROUTES.corporate.account}#messages`;
}

export function accountAppointmentLink(): string {
  return `${ROUTES.corporate.account}#book-visit`;
}

export function accountMessageLink(conversationId: string): string {
  return `${ROUTES.corporate.account}?conversation=${encodeURIComponent(conversationId)}#messages`;
}

export function accountShipmentLink(): string {
  return `${ROUTES.corporate.account}#shipment-tracking`;
}

export function accountNotificationsLink(): string {
  return `${ROUTES.corporate.account}#notifications`;
}
