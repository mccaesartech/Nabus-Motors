import {
  COMPANY_NAME,
  GOOGLE_MAPS_URL,
  SITE_ADDRESS_FULL,
  SITE_ADDRESS_LINE1,
  SITE_ADDRESS_LINE2,
  SITE_EMAIL,
  SITE_NAME,
  SITE_PHONE_DISPLAY,
  WHATSAPP_NUMBER,
} from "@/lib/constants";
import { DEFAULT_DISPLAY_CURRENCY } from "@/lib/currency/types";
import { DEFAULT_CARGO_OPTIONS_JSON } from "@/lib/freight/cargo-options";

import { INVITABLE_ROLES, ROLE_LABELS, type PlatformRole } from "@/lib/platform/permissions";

export const PLATFORM_USER_ROLES = INVITABLE_ROLES;

export type PlatformUserRole = PlatformRole;

export const DOCUMENT_TYPES = [
  { id: "sales_agreement", label: "Sales Agreement" },
  { id: "preorder_agreement", label: "Pre-Order Agreement" },
  { id: "invoice", label: "Invoice Template" },
] as const;

export const SITE_SETTING_KEY_LIST = [
  "company_name",
  "company_legal_name",
  "tagline",
  "phone",
  "email",
  "address",
  "address_line1",
  "address_line2",
  "google_maps_url",
  "whatsapp_number",
  "notification_email",
  "hours_weekday",
  "hours_saturday",
  "hours_sunday",
  "clearing_fee_notice",
  "preorder_terms_a",
  "preorder_terms_b",
  "preorder_terms_c",
  "social_facebook",
  "social_instagram",
  "social_linkedin",
  "default_currency_display",
  "inventory_low_stock_threshold",
  "appointment_branches",
  "freight_default_origins",
  "freight_cargo_options",
  "freight_quote_notification_email",
  "notify_email_enabled",
  "notify_freight_quotes_enabled",
  "notify_preorders_enabled",
  "notify_low_stock_enabled",
  "shipment_update_frequency",
  "maintenance_mode",
  "maintenance_message",
  "feature_show_spare_parts_nav",
  "feature_show_freight_nav",
  "whatsapp_api_provider",
  "whatsapp_phone_number_id",
  "whatsapp_api_access_token",
  "twilio_account_sid",
  "twilio_auth_token",
  "twilio_whatsapp_from",
  "termii_api_key",
  "termii_sender_id",
  "termii_whatsapp_device",
  "termii_base_url",
  "termii_sms_channel",
] as const;

export type SiteSettingKey = (typeof SITE_SETTING_KEY_LIST)[number];

export type SiteSettingsMap = Record<SiteSettingKey, string>;

export const DEFAULT_SITE_SETTINGS: SiteSettingsMap = {
  company_name: SITE_NAME,
  company_legal_name: COMPANY_NAME,
  tagline: "Your Safe Place for Quality Vehicles",
  phone: SITE_PHONE_DISPLAY,
  email: SITE_EMAIL,
  address: SITE_ADDRESS_FULL,
  address_line1: SITE_ADDRESS_LINE1,
  address_line2: SITE_ADDRESS_LINE2,
  google_maps_url: GOOGLE_MAPS_URL,
  whatsapp_number: WHATSAPP_NUMBER,
  notification_email: SITE_EMAIL,
  hours_weekday: "Mon–Fri: 9:00 AM – 7:00 PM",
  hours_saturday: "Sat: 9:00 AM – 5:00 PM",
  hours_sunday: "Sun: Closed",
  clearing_fee_notice:
    "Clearing fees, duties, and port charges vary by shipment type, vehicle value, and Ghana Customs assessment. True Goshen will provide a detailed breakdown before you commit. Contact our freight team for a personalised quote — prices are not fixed on this notice.",
  preorder_terms_a: "Option A — I will arrange my own shipping and clearing",
  preorder_terms_b: "Option B — True Goshen handles freight forwarding & clearing",
  preorder_terms_c: "Option C — I need consultation before deciding",
  social_facebook: "",
  social_instagram: "",
  social_linkedin: "",
  default_currency_display: DEFAULT_DISPLAY_CURRENCY,
  inventory_low_stock_threshold: "5",
  appointment_branches: "Accra",
  freight_default_origins: "China\nJapan\nUSA\nUnited Kingdom\nUAE",
  freight_cargo_options: DEFAULT_CARGO_OPTIONS_JSON,
  freight_quote_notification_email: SITE_EMAIL,
  notify_email_enabled: "true",
  notify_freight_quotes_enabled: "true",
  notify_preorders_enabled: "true",
  notify_low_stock_enabled: "true",
  shipment_update_frequency: "every_update",
  maintenance_mode: "false",
  maintenance_message:
    "We are performing scheduled maintenance. Some features may be temporarily unavailable.",
  feature_show_spare_parts_nav: "true",
  feature_show_freight_nav: "true",
  whatsapp_api_provider: "",
  whatsapp_phone_number_id: "",
  whatsapp_api_access_token: "",
  twilio_account_sid: "",
  twilio_auth_token: "",
  twilio_whatsapp_from: "",
  termii_api_key: "",
  termii_sender_id: "",
  termii_whatsapp_device: "",
  termii_base_url: "https://api.ng.termii.com",
  termii_sms_channel: "dnd",
};

export const SITE_SETTING_KEYS: SiteSettingKey[] = [...SITE_SETTING_KEY_LIST];

export type ExpenseRow = {
  id: string;
  description: string;
  amount_usd: number;
  expense_date: string;
  created_at: string;
};

export type PlatformUserInviteInfo = {
  status: "active" | "accepted" | "expired" | "none";
  inviteUrl?: string;
  expiresAt?: string;
  acceptedAt?: string;
  needsRegenerate?: boolean;
};

export type PlatformUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  phone: string | null;
  job_title: string | null;
  created_at: string;
  invited_at: string | null;
  activated_at: string | null;
  last_login_at: string | null;
  invite?: PlatformUserInviteInfo;
};

export type PlatformInviteRow = {
  id: string;
  user_id: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export type PlatformActivityRow = {
  id: string;
  user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  resource: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export { ROLE_LABELS };

export type DocumentRow = {
  id: string;
  title: string;
  doc_type: string;
  url: string | null;
  vehicle_id: string | null;
  customer_name: string | null;
  created_at: string;
};
