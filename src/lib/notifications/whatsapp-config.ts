import "server-only";
import { getAdminSiteSettings } from "@/lib/platform/site-settings";
import { getTermiiConfig } from "@/lib/notifications/termii-config";
import { parseBoolean } from "@/lib/platform/site-settings";

export type WhatsAppProvider = "twilio" | "meta" | "termii" | "";

export type WhatsAppConfig = {
  provider: WhatsAppProvider;
  configured: boolean;
  enabled: boolean;
  phoneNumberId: string;
  businessAccountId: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFrom: string;
  metaAccessToken: string;
  defaultCountry: string;
  teamWhatsAppEnabled: boolean;
  source: "env" | "settings" | "none";
  /** Raw settings map used for Meta template name resolution. */
  settings: Record<string, string>;
};

function normalizeSecret(value: string | undefined): string {
  if (!value) return "";
  return value.trim().replace(/^["']|["']$/g, "");
}

function envWhatsAppEnabled(): boolean | null {
  const raw = normalizeSecret(process.env.WHATSAPP_ENABLED);
  if (!raw) return null;
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "yes";
}

function readEnvProvider(): WhatsAppProvider {
  const unified = normalizeSecret(process.env.NOTIFICATION_PROVIDER)?.toLowerCase();
  if (unified === "termii") return "termii";
  const raw = normalizeSecret(process.env.WHATSAPP_PROVIDER)?.toLowerCase();
  if (raw === "twilio" || raw === "meta" || raw === "termii") return raw;
  if (normalizeSecret(process.env.SMS_PROVIDER)?.toLowerCase() === "termii") return "termii";
  if (normalizeSecret(process.env.TERMII_API_KEY)) return "termii";
  if (normalizeSecret(process.env.TWILIO_ACCOUNT_SID)) return "twilio";
  if (normalizeSecret(process.env.WHATSAPP_ACCESS_TOKEN)) return "meta";
  return "";
}

export function readWhatsAppConfigFromEnv(
  settings: Record<string, string> = {}
): WhatsAppConfig {
  const provider = readEnvProvider();
  const twilioAccountSid = normalizeSecret(process.env.TWILIO_ACCOUNT_SID);
  const twilioAuthToken = normalizeSecret(process.env.TWILIO_AUTH_TOKEN);
  const twilioFrom =
    normalizeSecret(process.env.TWILIO_WHATSAPP_FROM) ||
    normalizeSecret(process.env.TWILIO_WHATSAPP_NUMBER);
  const metaAccessToken = normalizeSecret(process.env.WHATSAPP_ACCESS_TOKEN);
  const phoneNumberId = normalizeSecret(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const businessAccountId =
    normalizeSecret(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID) ||
    settings.whatsapp_business_account_id?.trim() ||
    "";
  const termiiApiKey = normalizeSecret(process.env.TERMII_API_KEY);
  const termiiDevice =
    normalizeSecret(process.env.TERMII_WHATSAPP_DEVICE_ID) ||
    normalizeSecret(process.env.TERMII_WHATSAPP_DEVICE) ||
    normalizeSecret(process.env.TERMII_WHATSAPP_FROM) ||
    normalizeSecret(process.env.TERMII_SENDER_ID);

  const termiiReady = Boolean(termiiApiKey && termiiDevice);
  const twilioReady = Boolean(twilioAccountSid && twilioAuthToken && twilioFrom);
  const metaReady = Boolean(metaAccessToken && phoneNumberId);
  const configured =
    (provider === "termii" && termiiReady) ||
    (provider === "twilio" && twilioReady) ||
    (provider === "meta" && metaReady) ||
    (!provider && (termiiReady || twilioReady || metaReady));

  const envEnabled = envWhatsAppEnabled();
  const settingsEnabled = parseBoolean(settings.whatsapp_enabled, true);
  const enabled = envEnabled === null ? settingsEnabled : envEnabled;

  return {
    provider:
      provider ||
      (termiiReady ? "termii" : twilioReady ? "twilio" : metaReady ? "meta" : ""),
    configured,
    enabled,
    phoneNumberId,
    businessAccountId,
    twilioAccountSid,
    twilioAuthToken,
    twilioFrom,
    metaAccessToken,
    defaultCountry: settings.whatsapp_default_country?.trim() || "GH",
    teamWhatsAppEnabled: parseBoolean(settings.notify_team_whatsapp_enabled, true),
    source: configured ? "env" : "none",
    settings,
  };
}

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const settings = await getAdminSiteSettings();
  const envConfig = readWhatsAppConfigFromEnv(settings);
  if (envConfig.configured) {
    // Env credentials win, but keep kill-switch / template settings from DB.
    return {
      ...envConfig,
      businessAccountId:
        envConfig.businessAccountId ||
        settings.whatsapp_business_account_id?.trim() ||
        "",
      defaultCountry: settings.whatsapp_default_country?.trim() || "GH",
      teamWhatsAppEnabled: parseBoolean(settings.notify_team_whatsapp_enabled, true),
      settings,
    };
  }

  const provider = (settings.whatsapp_api_provider?.trim().toLowerCase() ||
    "") as WhatsAppProvider;

  const phoneNumberId = settings.whatsapp_phone_number_id?.trim() || "";
  const metaAccessToken = settings.whatsapp_api_access_token?.trim() || "";
  const twilioAccountSid = settings.twilio_account_sid?.trim() || "";
  const twilioAuthToken = settings.twilio_auth_token?.trim() || "";
  const twilioFrom = settings.twilio_whatsapp_from?.trim() || "";
  const businessAccountId = settings.whatsapp_business_account_id?.trim() || "";

  const termiiConfig = await getTermiiConfig();
  const termiiReady = termiiConfig.whatsappReady;
  const twilioReady = Boolean(twilioAccountSid && twilioAuthToken && twilioFrom);
  const metaReady = Boolean(metaAccessToken && phoneNumberId);
  const configured =
    (provider === "termii" && termiiReady) ||
    (provider === "twilio" && twilioReady) ||
    (provider === "meta" && metaReady) ||
    (!provider && (termiiReady || twilioReady || metaReady));

  const envEnabled = envWhatsAppEnabled();
  const settingsEnabled = parseBoolean(settings.whatsapp_enabled, true);
  const enabled = envEnabled === null ? settingsEnabled : envEnabled;

  return {
    provider:
      provider ||
      (termiiReady ? "termii" : twilioReady ? "twilio" : metaReady ? "meta" : ""),
    configured,
    enabled,
    phoneNumberId,
    businessAccountId,
    twilioAccountSid,
    twilioAuthToken,
    twilioFrom,
    metaAccessToken,
    defaultCountry: settings.whatsapp_default_country?.trim() || "GH",
    teamWhatsAppEnabled: parseBoolean(settings.notify_team_whatsapp_enabled, true),
    source: configured ? "settings" : "none",
    settings,
  };
}

/** Kill-switch: WHATSAPP_ENABLED env overrides site setting whatsapp_enabled. */
export async function isWhatsAppSendingEnabled(): Promise<boolean> {
  const config = await getWhatsAppConfig();
  return config.enabled;
}
