import "server-only";
import { getAdminSiteSettings } from "@/lib/platform/site-settings";

export type WhatsAppProvider = "twilio" | "meta" | "";

export type WhatsAppConfig = {
  provider: WhatsAppProvider;
  configured: boolean;
  phoneNumberId: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFrom: string;
  metaAccessToken: string;
  source: "env" | "settings" | "none";
};

function normalizeSecret(value: string | undefined): string {
  if (!value) return "";
  return value.trim().replace(/^["']|["']$/g, "");
}

function readEnvProvider(): WhatsAppProvider {
  const raw = normalizeSecret(process.env.WHATSAPP_PROVIDER)?.toLowerCase();
  if (raw === "twilio" || raw === "meta") return raw;
  if (normalizeSecret(process.env.TWILIO_ACCOUNT_SID)) return "twilio";
  if (normalizeSecret(process.env.WHATSAPP_ACCESS_TOKEN)) return "meta";
  return "";
}

export function readWhatsAppConfigFromEnv(): WhatsAppConfig {
  const provider = readEnvProvider();
  const twilioAccountSid = normalizeSecret(process.env.TWILIO_ACCOUNT_SID);
  const twilioAuthToken = normalizeSecret(process.env.TWILIO_AUTH_TOKEN);
  const twilioFrom =
    normalizeSecret(process.env.TWILIO_WHATSAPP_FROM) ||
    normalizeSecret(process.env.TWILIO_WHATSAPP_NUMBER);
  const metaAccessToken = normalizeSecret(process.env.WHATSAPP_ACCESS_TOKEN);
  const phoneNumberId = normalizeSecret(process.env.WHATSAPP_PHONE_NUMBER_ID);

  const twilioReady = Boolean(twilioAccountSid && twilioAuthToken && twilioFrom);
  const metaReady = Boolean(metaAccessToken && phoneNumberId);
  const configured =
    (provider === "twilio" && twilioReady) ||
    (provider === "meta" && metaReady) ||
    (!provider && (twilioReady || metaReady));

  return {
    provider: provider || (twilioReady ? "twilio" : metaReady ? "meta" : ""),
    configured,
    phoneNumberId,
    twilioAccountSid,
    twilioAuthToken,
    twilioFrom,
    metaAccessToken,
    source: configured ? "env" : "none",
  };
}

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const envConfig = readWhatsAppConfigFromEnv();
  if (envConfig.configured) return envConfig;

  const settings = await getAdminSiteSettings();
  const provider = (settings.whatsapp_api_provider?.trim().toLowerCase() ||
    "") as WhatsAppProvider;

  const phoneNumberId = settings.whatsapp_phone_number_id?.trim() || "";
  const metaAccessToken = settings.whatsapp_api_access_token?.trim() || "";
  const twilioAccountSid = settings.twilio_account_sid?.trim() || "";
  const twilioAuthToken = settings.twilio_auth_token?.trim() || "";
  const twilioFrom = settings.twilio_whatsapp_from?.trim() || "";

  const twilioReady = Boolean(twilioAccountSid && twilioAuthToken && twilioFrom);
  const metaReady = Boolean(metaAccessToken && phoneNumberId);
  const configured =
    (provider === "twilio" && twilioReady) ||
    (provider === "meta" && metaReady) ||
    (!provider && (twilioReady || metaReady));

  return {
    provider: provider || (twilioReady ? "twilio" : metaReady ? "meta" : ""),
    configured,
    phoneNumberId,
    twilioAccountSid,
    twilioAuthToken,
    twilioFrom,
    metaAccessToken,
    source: configured ? "settings" : "none",
  };
}
