import { createAdminSupabase } from "@/lib/supabase/admin";
import { DEFAULT_SITE_SETTINGS, SITE_SETTING_KEYS, type SiteSettingKey, type SiteSettingsMap } from "@/lib/platform/modules";

export type ShipmentUpdateFrequency = "every_update" | "milestones_only";

export function parseShipmentUpdateFrequency(
  value: string | undefined
): ShipmentUpdateFrequency {
  return value === "milestones_only" ? "milestones_only" : "every_update";
}

export type SiteSettings = SiteSettingsMap;

export type OperationalSettings = SiteSettings & {
  lowStockThreshold: number;
  appointmentBranchList: string[];
  freightOriginList: string[];
  maintenanceMode: boolean;
  featureShowSparePartsNav: boolean;
  featureShowFreightNav: boolean;
  notifyEmailEnabled: boolean;
  notifyFreightQuotesEnabled: boolean;
  notifyPreordersEnabled: boolean;
  notifyLowStockEnabled: boolean;
  shipmentUpdateFrequency: ShipmentUpdateFrequency;
};

const BOOLEAN_KEYS = [
  "maintenance_mode",
  "feature_show_spare_parts_nav",
  "feature_show_freight_nav",
  "notify_email_enabled",
  "notify_freight_quotes_enabled",
  "notify_preorders_enabled",
  "notify_low_stock_enabled",
] as const;

function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

function parseList(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseThreshold(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5;
}

export function mergeSiteSettings(
  rows?: { key: string; value: string }[] | null
): SiteSettings {
  const settings = { ...DEFAULT_SITE_SETTINGS } as SiteSettings;
  for (const row of rows ?? []) {
    if (SITE_SETTING_KEYS.includes(row.key as SiteSettingKey)) {
      settings[row.key as SiteSettingKey] = row.value;
    }
  }
  return settings;
}

export function toOperationalSettings(settings: SiteSettings): OperationalSettings {
  return {
    ...settings,
    lowStockThreshold: parseThreshold(settings.inventory_low_stock_threshold),
    appointmentBranchList: parseList(settings.appointment_branches),
    freightOriginList: parseList(settings.freight_default_origins),
    maintenanceMode: parseBoolean(settings.maintenance_mode, false),
    featureShowSparePartsNav: parseBoolean(settings.feature_show_spare_parts_nav, true),
    featureShowFreightNav: parseBoolean(settings.feature_show_freight_nav, true),
    notifyEmailEnabled: parseBoolean(settings.notify_email_enabled, true),
    notifyFreightQuotesEnabled: parseBoolean(settings.notify_freight_quotes_enabled, true),
    notifyPreordersEnabled: parseBoolean(settings.notify_preorders_enabled, true),
    notifyLowStockEnabled: parseBoolean(settings.notify_low_stock_enabled, true),
    shipmentUpdateFrequency: parseShipmentUpdateFrequency(settings.shipment_update_frequency),
  };
}

export async function getAdminSiteSettings(): Promise<SiteSettings> {
  const supabase = createAdminSupabase();
  if (!supabase) {
    return DEFAULT_SITE_SETTINGS as SiteSettings;
  }

  const { data, error } = await supabase.from("site_settings").select("key, value");
  if (error) {
    return DEFAULT_SITE_SETTINGS as SiteSettings;
  }

  return mergeSiteSettings(data);
}

export function isLowStock(availableVehicles: number, threshold: number): boolean {
  return availableVehicles < threshold;
}

export { BOOLEAN_KEYS, parseBoolean, parseList, parseThreshold };
