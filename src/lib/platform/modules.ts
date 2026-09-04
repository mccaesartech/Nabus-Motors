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

import {
  INVITABLE_ROLES,
  PRODUCT_ROLES,
  ROLE_LABELS,
  type PlatformRole,
} from "@/lib/platform/permissions";

/** Assignable roles for invite / role-change UI (excludes owner + legacy IAM). */
export const PLATFORM_USER_ROLES = INVITABLE_ROLES;

/** Product role set: owner, super_admin, manager, staff. */
export const PLATFORM_PRODUCT_ROLES = PRODUCT_ROLES;

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
  "maintenance_enabled_by",
  "maintenance_enabled_at",
  "maintenance_disabled_by",
  "maintenance_disabled_at",
  "maintenance_updated_by",
  "maintenance_updated_at",
  "feature_show_spare_parts_nav",
  "feature_show_freight_nav",
  "whatsapp_api_provider",
  "whatsapp_phone_number_id",
  "whatsapp_api_access_token",
  "whatsapp_enabled",
  "whatsapp_business_account_id",
  "whatsapp_default_country",
  "notify_team_whatsapp_enabled",
  "whatsapp_template_password_reset",
  "whatsapp_template_team_invite",
  "whatsapp_template_team_welcome",
  "whatsapp_template_team_role_changed",
  "whatsapp_template_team_password_set",
  "whatsapp_template_language",
  "twilio_account_sid",
  "twilio_auth_token",
  "twilio_whatsapp_from",
  "termii_api_key",
  "termii_sender_id",
  "termii_whatsapp_device",
  "termii_base_url",
  "termii_sms_channel",
  "arkesel_api_key",
  "arkesel_sender_id",
  "arkesel_base_url",
  "arkesel_enabled",
  "audit_log_retention_days",
  "audit_log_enabled",
  "fx_use_live_rates",
  "fx_manual_rates_json",
  "fx_manual_rate_reason",
  "fx_manual_rate_set_by",
  "fx_manual_rate_set_at",
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
    "Clearing fees, duties, and port charges vary by shipment type, vehicle value, and Ghana Customs assessment. Nabus Motors will provide a detailed breakdown before you commit. Contact our freight team for a personalised quote — prices are not fixed on this notice.",
  preorder_terms_a: "Option A — I will arrange my own shipping and clearing",
  preorder_terms_b: "Option B — Nabus Motors handles freight forwarding & clearing",
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
  maintenance_enabled_by: "",
  maintenance_enabled_at: "",
  maintenance_disabled_by: "",
  maintenance_disabled_at: "",
  maintenance_updated_by: "",
  maintenance_updated_at: "",
  feature_show_spare_parts_nav: "true",
  feature_show_freight_nav: "true",
  whatsapp_api_provider: "",
  whatsapp_phone_number_id: "",
  whatsapp_api_access_token: "",
  whatsapp_enabled: "true",
  whatsapp_business_account_id: "",
  whatsapp_default_country: "GH",
  notify_team_whatsapp_enabled: "true",
  whatsapp_template_password_reset: "password_reset",
  whatsapp_template_team_invite: "team_invite",
  whatsapp_template_team_welcome: "team_welcome",
  whatsapp_template_team_role_changed: "team_role_changed",
  whatsapp_template_team_password_set: "team_password_set",
  whatsapp_template_language: "en",
  twilio_account_sid: "",
  twilio_auth_token: "",
  twilio_whatsapp_from: "",
  termii_api_key: "",
  termii_sender_id: "",
  termii_whatsapp_device: "",
  termii_base_url: "https://api.ng.termii.com",
  termii_sms_channel: "dnd",
  arkesel_api_key: "",
  arkesel_sender_id: "",
  arkesel_base_url: "https://sms.arkesel.com",
  arkesel_enabled: "true",
  audit_log_retention_days: "365",
  audit_log_enabled: "true",
  fx_use_live_rates: "true",
  fx_manual_rates_json: "{}",
  fx_manual_rate_reason: "",
  fx_manual_rate_set_by: "",
  fx_manual_rate_set_at: "",
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
  /** Last Resend attempt for this invite row (migration 089). */
  emailStatus?: "PENDING" | "SENT" | "FAILED";
};

/** Delivery outcome for invite / role / password team notifications. */
export type PlatformUserNotifyInfo = {
  channel: "sms" | "whatsapp" | "none" | "email";
  status: "sent" | "skipped_no_phone" | "skipped_not_configured" | "failed" | "pending";
  /** Short Owner-facing label (e.g. "SMS submitted" / "SMS failed"). */
  label: string;
  /** Arkesel message id on accept, or a technical reason on failure (tooltip / logs). */
  detail?: string;
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
  must_change_password?: boolean;
  invite?: PlatformUserInviteInfo;
  /** Last invite/role notification status from this session (not persisted). */
  notify?: PlatformUserNotifyInfo;
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
