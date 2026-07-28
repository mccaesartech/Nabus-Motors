import "server-only";
import { getAdminSiteSettings, parseBoolean } from "@/lib/platform/site-settings";
import { getWhatsAppConfig } from "@/lib/notifications/whatsapp-config";

export type ArkeselConfig = {
  apiKey: string;
  senderId: string;
  baseUrl: string;
  enabled: boolean;
  configured: boolean;
  smsReady: boolean;
  source: "env" | "settings" | "none";
};

const DEFAULT_BASE_URL = "https://sms.arkesel.com";

function normalizeSecret(value: string | undefined): string {
  if (!value) return "";
  return value.trim().replace(/^["']|["']$/g, "");
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_BASE_URL;
  if (trimmed.startsWith("http")) return trimmed;
  return `https://${trimmed}`;
}

function envArkeselEnabled(): boolean | null {
  const raw = normalizeSecret(process.env.ARKESEL_ENABLED);
  if (!raw) return null;
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "yes";
}

/** True when env explicitly selects Arkesel as SMS / notification provider. */
export function isArkeselProviderEnv(): boolean {
  const unified = normalizeSecret(process.env.NOTIFICATION_PROVIDER)?.toLowerCase();
  const sms = normalizeSecret(process.env.SMS_PROVIDER)?.toLowerCase();
  return unified === "arkesel" || sms === "arkesel";
}

export function isArkeselConfigReady(input: {
  apiKey?: string;
  senderId?: string;
  enabled?: boolean;
}): boolean {
  const apiKey = input.apiKey?.trim() ?? "";
  const senderId = input.senderId?.trim() ?? "";
  const enabled = input.enabled !== false;
  return enabled && Boolean(apiKey && senderId);
}

function readArkeselFromEnv(
  settings: Record<string, string> = {}
): ArkeselConfig {
  const apiKey = normalizeSecret(process.env.ARKESEL_API_KEY);
  const senderId =
    normalizeSecret(process.env.ARKESEL_SENDER_ID) ||
    normalizeSecret(process.env.ARKESEL_SENDER);
  const baseUrl = normalizeBaseUrl(
    normalizeSecret(process.env.ARKESEL_BASE_URL) || DEFAULT_BASE_URL
  );

  const envEnabled = envArkeselEnabled();
  const settingsEnabled = parseBoolean(settings.arkesel_enabled, true);
  const enabled = envEnabled === null ? settingsEnabled : envEnabled;

  const smsReady = isArkeselConfigReady({ apiKey, senderId, enabled });
  const configured = Boolean(apiKey && senderId);

  return {
    apiKey,
    senderId,
    baseUrl,
    enabled,
    configured,
    smsReady,
    source: configured ? "env" : "none",
  };
}

export function readArkeselConfigFromEnv(
  settings: Record<string, string> = {}
): ArkeselConfig {
  return readArkeselFromEnv(settings);
}

export async function getArkeselConfig(): Promise<ArkeselConfig> {
  const settings = await getAdminSiteSettings();
  const envConfig = readArkeselFromEnv(settings);
  if (envConfig.configured) {
    return {
      ...envConfig,
      // Env credentials win; keep kill-switch from DB when env toggle unset.
      enabled:
        envArkeselEnabled() === null
          ? parseBoolean(settings.arkesel_enabled, true)
          : envConfig.enabled,
      smsReady: isArkeselConfigReady({
        apiKey: envConfig.apiKey,
        senderId: envConfig.senderId,
        enabled:
          envArkeselEnabled() === null
            ? parseBoolean(settings.arkesel_enabled, true)
            : envConfig.enabled,
      }),
    };
  }

  const apiKey = settings.arkesel_api_key?.trim() || "";
  const senderId = settings.arkesel_sender_id?.trim() || "";
  const baseUrl = normalizeBaseUrl(
    settings.arkesel_base_url?.trim() || DEFAULT_BASE_URL
  );
  const enabled = parseBoolean(settings.arkesel_enabled, true);
  const configured = Boolean(apiKey && senderId);
  const smsReady = isArkeselConfigReady({ apiKey, senderId, enabled });

  return {
    apiKey,
    senderId,
    baseUrl,
    enabled,
    configured,
    smsReady,
    source: configured ? "settings" : "none",
  };
}

/**
 * Prefer Arkesel SMS over WhatsApp when:
 * - SMS_PROVIDER / NOTIFICATION_PROVIDER is arkesel and credentials are ready, or
 * - Arkesel is ready and WhatsApp is not configured / disabled.
 */
export async function shouldPreferArkeselSms(): Promise<boolean> {
  const arkesel = await getArkeselConfig();
  if (!arkesel.smsReady) return false;
  if (isArkeselProviderEnv()) return true;

  const whatsapp = await getWhatsAppConfig();
  return !whatsapp.configured || !whatsapp.enabled;
}
