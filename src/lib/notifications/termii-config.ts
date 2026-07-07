import "server-only";
import { getAdminSiteSettings } from "@/lib/platform/site-settings";

export type TermiiChannel = "whatsapp" | "dnd" | "generic";

export type TermiiConfig = {
  apiKey: string;
  baseUrl: string;
  senderId: string;
  whatsappDevice: string;
  smsChannel: "dnd" | "generic";
  configured: boolean;
  whatsappReady: boolean;
  smsReady: boolean;
  source: "env" | "settings" | "none";
};

function normalizeSecret(value: string | undefined): string {
  if (!value) return "";
  return value.trim().replace(/^["']|["']$/g, "");
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "https://api.ng.termii.com";
  if (trimmed.startsWith("http")) return trimmed;
  return `https://${trimmed}`;
}

export function isTermiiProviderEnv(): boolean {
  const unified = normalizeSecret(process.env.NOTIFICATION_PROVIDER)?.toLowerCase();
  const whatsapp = normalizeSecret(process.env.WHATSAPP_PROVIDER)?.toLowerCase();
  const sms = normalizeSecret(process.env.SMS_PROVIDER)?.toLowerCase();
  return unified === "termii" || whatsapp === "termii" || sms === "termii";
}

function readTermiiFromEnv(): TermiiConfig {
  const apiKey = normalizeSecret(process.env.TERMII_API_KEY);
  const baseUrl = normalizeBaseUrl(
    normalizeSecret(process.env.TERMII_BASE_URL) || "https://api.ng.termii.com"
  );
  const senderId =
    normalizeSecret(process.env.TERMII_SENDER_ID) ||
    normalizeSecret(process.env.TERMII_SENDER);
  const whatsappDevice =
    normalizeSecret(process.env.TERMII_WHATSAPP_DEVICE_ID) ||
    normalizeSecret(process.env.TERMII_WHATSAPP_DEVICE) ||
    normalizeSecret(process.env.TERMII_WHATSAPP_FROM) ||
    senderId;
  const smsChannelRaw = normalizeSecret(process.env.TERMII_SMS_CHANNEL)?.toLowerCase();
  const smsChannel: "dnd" | "generic" = smsChannelRaw === "generic" ? "generic" : "dnd";

  const whatsappReady = Boolean(apiKey && whatsappDevice);
  const smsReady = Boolean(apiKey && senderId);
  const configured = whatsappReady || smsReady;

  return {
    apiKey,
    baseUrl,
    senderId,
    whatsappDevice,
    smsChannel,
    configured,
    whatsappReady,
    smsReady,
    source: configured ? "env" : "none",
  };
}

export async function getTermiiConfig(): Promise<TermiiConfig> {
  const envConfig = readTermiiFromEnv();
  if (envConfig.configured) return envConfig;

  const settings = await getAdminSiteSettings();
  const apiKey = settings.termii_api_key?.trim() || "";
  const baseUrl = normalizeBaseUrl(settings.termii_base_url?.trim() || "https://api.ng.termii.com");
  const senderId = settings.termii_sender_id?.trim() || "";
  const whatsappDevice =
    settings.termii_whatsapp_device?.trim() || senderId;
  const smsChannelRaw = settings.termii_sms_channel?.trim().toLowerCase();
  const smsChannel: "dnd" | "generic" = smsChannelRaw === "generic" ? "generic" : "dnd";

  const whatsappReady = Boolean(apiKey && whatsappDevice);
  const smsReady = Boolean(apiKey && senderId);
  const configured = whatsappReady || smsReady;

  return {
    apiKey,
    baseUrl,
    senderId,
    whatsappDevice,
    smsChannel,
    configured,
    whatsappReady,
    smsReady,
    source: configured ? "settings" : "none",
  };
}
