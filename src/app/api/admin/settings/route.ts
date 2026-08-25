import { NextRequest, NextResponse } from "next/server";
import { dbFailure } from "@/lib/errors/api";
import { logAppError } from "@/lib/errors/logger";
import { requirePermission } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { checkDbHealth } from "@/lib/supabase/health";
import { DEFAULT_SITE_SETTINGS, SITE_SETTING_KEYS, type SiteSettingKey } from "@/lib/platform/modules";
import { mergeSiteSettings, parseBoolean } from "@/lib/platform/site-settings";
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
import { logPlatformActivity } from "@/lib/platform/activity";
import { enqueueAuditLog } from "@/lib/audit/write";
import { revalidateSiteSettings } from "@/lib/platform/site-settings-server";
import { invalidateMaintenanceCache } from "@/lib/maintenance/state";

const SETTINGS_DB_UNREACHABLE =
  "Settings could not be read from the database, so defaults are shown. Reload to retry.";

const API_KEY_SETTING_KEYS = new Set([
  "whatsapp_api_access_token",
  "arkesel_api_key",
  "twilio_auth_token",
  "termii_api_key",
]);

function actorLabel(auth: { name: string; email: string }): string {
  const name = auth.name?.trim();
  const email = auth.email?.trim();
  if (name && email) return `${name} <${email}>`;
  return name || email || "Owner";
}

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
    const errorId = logAppError({
      error,
      module: "api.admin.settings.GET",
      userMessage: SETTINGS_DB_UNREACHABLE,
      kind: "database",
      status: 200,
      dbCode: error.code,
    });
    return NextResponse.json({
      ok: true,
      configured: true,
      settings: maskSettingsSecrets(DEFAULT_SITE_SETTINGS),
      db: { ...db, connected: false, error: `${SETTINGS_DB_UNREACHABLE} (Reference ${errorId})` },
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

  // Audit metadata is written server-side only — ignore client copies.
  delete updates.maintenance_enabled_by;
  delete updates.maintenance_enabled_at;
  delete updates.maintenance_disabled_by;
  delete updates.maintenance_disabled_at;
  delete updates.maintenance_updated_by;
  delete updates.maintenance_updated_at;

  const supabase = createAdminSupabase();
  if (!supabase) {
    invalidateMaintenanceCache();
    return NextResponse.json({
      ok: true,
      configured: false,
      message: "Saved locally only — configure Supabase to persist.",
      settings: maskSettingsSecrets({ ...DEFAULT_SITE_SETTINGS, ...updates }),
    });
  }

  // Capture prior maintenance flag when the toggle is part of this save.
  let previousMaintenance: boolean | null = null;
  if (Object.prototype.hasOwnProperty.call(updates, "maintenance_mode")) {
    const { data: priorRows } = await supabase
      .from("site_settings")
      .select("key, value")
      .eq("key", "maintenance_mode");
    previousMaintenance = parseBoolean(priorRows?.[0]?.value, false);
  }

  const nowIso = new Date().toISOString();
  const actor = actorLabel(auth.auth);

  // Only stamp enable/disable audit when the flag actually flips — not on every settings save.
  if (previousMaintenance !== null) {
    const nextOn = parseBoolean(String(updates.maintenance_mode), false);
    if (nextOn !== previousMaintenance) {
      updates.maintenance_updated_by = actor;
      updates.maintenance_updated_at = nowIso;
      if (nextOn) {
        updates.maintenance_enabled_by = actor;
        updates.maintenance_enabled_at = nowIso;
      } else {
        updates.maintenance_disabled_by = actor;
        updates.maintenance_disabled_at = nowIso;
      }
    }
  }

  const rows = Object.entries(updates).map(([key, value]) => ({
    key,
    value: String(value),
    updated_at: nowIso,
  }));

  const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });

  if (error) {
    console.error("Supabase site_settings upsert failed:", error.message);
    return dbFailure(error, {
      module: "api.admin.settings.PATCH",
      message: "Your settings could not be saved. Try again.",
      request: req,
    });
  }

  invalidateMaintenanceCache();
  try {
    revalidateSiteSettings();
  } catch {
    // revalidateTag can throw outside a request context in some runtimes — ignore.
  }

  const changedKeys = Object.keys(updates);
  if (previousMaintenance !== null) {
    const nextOn = parseBoolean(String(updates.maintenance_mode), false);
    if (nextOn !== previousMaintenance) {
      await logPlatformActivity(
        auth.auth,
        nextOn ? "maintenance_enabled" : "maintenance_disabled",
        "maintenance_mode",
        {
          enabled: nextOn,
          message: updates.maintenance_message ?? null,
          actor,
        }
      );
    } else {
      await logPlatformActivity(auth.auth, "settings_updated", "site_settings", {
        keys: changedKeys,
      });
    }
  } else {
    await logPlatformActivity(auth.auth, "settings_updated", "site_settings", {
      keys: changedKeys,
    });
  }

  enqueueAuditLog({
    action: "settings_changed",
    success: true,
    actor: auth.auth,
    targetType: "site_settings",
    metadata: { keys: changedKeys },
    request: req,
  });

  const apiKeyKeys = changedKeys.filter((key) => API_KEY_SETTING_KEYS.has(key));
  if (apiKeyKeys.length > 0) {
    enqueueAuditLog({
      action: "api_key_changed",
      success: true,
      actor: auth.auth,
      targetType: "site_settings",
      metadata: { keys: apiKeyKeys },
      request: req,
    });
  }

  return NextResponse.json({ ok: true, configured: true });
}
