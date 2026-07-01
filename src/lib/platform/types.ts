import type { VehicleGalleryData } from "@/lib/types";
import type { PreorderNotificationMetadata } from "./preorder";

export type PlatformStats = {
  totalVehicles: number;
  availableVehicles: number;
  featuredVehicles: number;
  soldVehicles: number;
  reservedVehicles: number;
  preOrderVehicles: number;
  /** Active pre-order pipeline (awaiting payment + deposit confirmed). */
  preOrderPipelineCount?: number;
  inventoryChartAvailable?: number;
  inventoryChartPreOrderPending?: number;
  inventoryChartPreOrderConfirmed?: number;
  inventoryChartReserved?: number;
  inventoryChartSold?: number;
  totalPreorderInquiries: number;
  downPaymentPaidCount: number;
  newPreorder: number;
  newContact: number;
  newVehicle: number;
  pendingFinance: number;
  pendingAppraisal: number;
  newsletter: number;
  totalLeads: number;
  estimatedRevenue: number;
  unreadNotifications?: number;
  lowStock?: boolean;
};

export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  sourceTable: string | null;
  sourceId: string | null;
  readAt: string | null;
  createdAt: string;
  metadata?: PreorderNotificationMetadata | Record<string, unknown>;
};

export type DbVehicle = {
  id: string;
  slug: string;
  make: string;
  model: string;
  year: number;
  trim?: string | null;
  price: number;
  mileage: number;
  fuel_type: string;
  transmission: string;
  condition: string;
  body_type: string;
  location: string;
  engine_size?: string | null;
  color?: string | null;
  vin?: string | null;
  description?: string | null;
  featured: boolean;
  status: string;
  approval_status?: string;
  approval_note?: string | null;
  pending_changes?: Record<string, unknown> | null;
  submitted_by?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  images?: string[];
  gallery?: VehicleGalleryData;
  created_at?: string;
  updated_at?: string;
};

export type InquiryTab =
  | "contact"
  | "vehicle"
  | "finance"
  | "appraisal"
  | "preorder"
  | "order"
  | "newsletter";

export type InquiryData = {
  contact?: Record<string, unknown>[];
  finance?: Record<string, unknown>[];
  appraisal?: Record<string, unknown>[];
  vehicle?: Record<string, unknown>[];
  preorder?: Record<string, unknown>[];
  order?: Record<string, unknown>[];
  newsletter?: Record<string, unknown>[];
};

export type PreorderPaymentStatus =
  | "pending"
  | "down_payment_paid"
  | "completed"
  | "cancelled";

export const PREORDER_PAYMENT_STATUSES = [
  "pending",
  "down_payment_paid",
  "completed",
  "cancelled",
] as const satisfies readonly PreorderPaymentStatus[];

export type UnifiedLead = {
  id: string;
  type: Exclude<InquiryTab, "newsletter">;
  name: string;
  email: string;
  phone?: string;
  summary: string;
  status: string;
  source: string;
  followUpNotes?: string;
  createdAt: string;
  vehicleTitle?: string;
  vehicleImage?: string;
  detailLink?: string;
  paymentStatus?: PreorderPaymentStatus;
  isCustomRequest?: boolean;
  referenceCode?: string;
};

export function leadTypeLabel(type: UnifiedLead["type"], isCustom?: boolean): string {
  if (type === "preorder") return isCustom ? "Pre-Order · Custom" : "Pre-Order";
  if (type === "order") return "Cart order";
  if (type === "appraisal") return "Trade-in";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export type CustomerRecord = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  source: string;
  leadCount: number;
  lastContact: string;
  status: string;
  registrationId?: string;
};

export const LEAD_STATUS_OPTIONS = [
  "new",
  "pending",
  "contacted",
  "qualified",
  "closed",
  "sold",
] as const;

export const ORDER_STATUS_OPTIONS = [
  "pending",
  "confirmed",
  "shipped",
  "fulfilled",
  "cancelled",
] as const;

export const LEAD_SOURCE_OPTIONS = [
  "website",
  "whatsapp",
  "phone",
  "walk-in",
  "referral",
  "social",
] as const;
