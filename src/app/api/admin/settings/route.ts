import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { checkDbHealth } from "@/lib/supabase/health";
import { DEFAULT_SITE_SETTINGS, SITE_SETTING_KEYS, type SiteSettingKey } from "@/lib/platform/modules";
import { mergeSiteSettings } from "@/lib/platform/site-settings";
import { getAutoSiteUrl, getPublicSiteUrl } from "@/lib/site-url";
import { getEmailDeliveryHealth } from "@/lib/email/delivery-health";
import { isTermiiProviderEnv } from "@/lib/notifications/termii-config";
import {
  isArkeselProviderEnv,
  readArkeselConfigFromEnv,
} from "@/lib/notifications/arkesel-config";
import { readWhatsAppConfigFromEnv } from "@/lib/notifications/whatsapp-config";
import {
  maskSettingsSecrets,
  stripMaskedSecretUpdates,
} from "@/lib/platform/settings-secrets";

export async function GET() {
  const auth = await requirePermission("settings");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const db = await checkDbHealth();
  const emailDelivery = getEmailDeliveryHealth();
  const termiiRecommended = isTermiiProviderEnv();
  const arkeselRecommended = isArkeselProviderEnv();
  const envWhatsApp = readWhatsAppConfigFromEnv();
  const envArkesel = readArkeselConfigFromEnv();
  const notificationMeta = {
    recommendedProvider: arkeselRecommended
      ? "arkesel"
      : termiiRecommended
        ? "termii"
        : envWhatsApp.provider === "meta"
          ? "meta"
          : null,
    termiiEnvConfigured: Boolean(process.env.TERMII_API_KEY?.trim()),
    arkeselEnvConfigured: envArkesel.configured,
    whatsappEnvConfigured: envWhatsApp.configured,
    whatsappEnvProvider: envWhatsApp.provider || null,
    whatsappEnvEnabled: envWhatsApp.enabled,
    webhookVerifyConfigured: Boolean(process.env.WHATSAPP_VERIFY_TOKEN?.trim()),
    webhookSecretConfigured: Boolean(process.env.WHATSAPP_APP_SECRET?.trim()),
  };

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      configured: false,
      settings: maskSettingsSecrets(DEFAULT_SITE_SETTINGS),
      db,
      meta: {
        publicSiteUrl: getPublicSiteUrl(),
        autoSiteUrl: getAutoSiteUrl(),
        emailDelivery,
        notification: notificationMeta,
      },
    });
  }

  const { data, error } = await supabase.from("site_settings").select("key, value");

  if (error) {
    console.error("Supabase site_settings fetch failed:", error.message);
    return NextResponse.json({
      ok: true,
      configured: true,
      settings: maskSettingsSecrets(DEFAULT_SITE_SETTINGS),
      db: { ...db, connected: false, error: error.message },
      meta: {
        publicSiteUrl: getPublicSiteUrl(),
        autoSiteUrl: getAutoSiteUrl(),
        emailDelivery,
        notification: notificationMeta,
      },
    });
  }

  const settings = maskSettingsSecrets(mergeSiteSettings(data));

  return NextResponse.json({
    ok: true,
    configured: true,
    settings,
    db,
    meta: {
      publicSiteUrl: getPublicSiteUrl(),
      autoSiteUrl: getAutoSiteUrl(),
      emailDelivery,
      notification: notificationMeta,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission("settings");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = (await req.json()) as Record<string, string>;
  const updates = stripMaskedSecretUpdates(
    Object.fromEntries(
      Object.entries(body).filter(([key]) =>
        SITE_SETTING_KEYS.includes(key as SiteSettingKey)
      )
    )
  );

  if (!Object.keys(updates).length) {
    return NextResponse.json({ ok: false, message: "No valid settings" }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      configured: false,
      message: "Saved locally only — configure Supabase to persist.",
      settings: maskSettingsSecrets({ ...DEFAULT_SITE_SETTINGS, ...updates }),
    });
  }

  const rows = Object.entries(updates).map(([key, value]) => ({
    key,
    value: String(value),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });

  if (error) {
    console.error("Supabase site_settings upsert failed:", error.message);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, configured: true });
}
