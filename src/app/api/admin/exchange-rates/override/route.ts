import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireFinanceAccess } from "@/lib/admin/auth";
import { enqueueAuditLog } from "@/lib/audit/write";
import { isValidCurrencyCode } from "@/lib/currency/codes";
import {
  buildManualRatesJson,
  isDisplayOverrideActive,
  parseManualRatesJson,
} from "@/lib/currency/display-override";
import { FX_ADMIN_OVERRIDE_LABEL, FX_MANUAL_LABEL } from "@/lib/currency/meta";
import { isFxEntityType } from "@/lib/currency/snapshot";
import { loadFxSnapshot, overrideFxSnapshot } from "@/lib/currency/snapshot-server";
import {
  EXCHANGE_RATES_CACHE_TAG,
  getMarketExchangeRates,
  getServerExchangeRates,
} from "@/lib/currency/server-rates";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSiteSettings, revalidateSiteSettings } from "@/lib/platform/site-settings-server";

export const dynamic = "force-dynamic";

function actorLabel(auth: { name: string; email: string }): string {
  const name = auth.name?.trim();
  const email = auth.email?.trim();
  if (name && email) return `${name} <${email}>`;
  return name || email || "Owner";
}

async function readPlatformOverrideStatus() {
  const [settings, market] = await Promise.all([
    getSiteSettings(),
    getMarketExchangeRates(),
  ]);
  const manualRates = parseManualRatesJson(settings.fx_manual_rates_json);
  const active = isDisplayOverrideActive(settings);

  return {
    active,
    useLiveRates: !active,
    targetCurrency: "GHS",
    rateUsed: manualRates.GHS ?? null,
    liveRate: market.rates.GHS ?? null,
    reason: settings.fx_manual_rate_reason?.trim() || null,
    setAt: settings.fx_manual_rate_set_at?.trim() || null,
    setBy: settings.fx_manual_rate_set_by?.trim() || null,
    label: active ? FX_ADMIN_OVERRIDE_LABEL : null,
    marketFetchedAt: market.fetchedAt,
    marketSource: market.source,
    marketStale: market.stale,
  };
}

async function persistPlatformOverride(input: {
  useLiveRates: boolean;
  ghsRate?: number;
  reason?: string;
  actor: { name: string; email: string };
}) {
  const supabase = createAdminSupabase();
  if (!supabase) {
    return { ok: false as const, message: "Database is not configured." };
  }

  const now = new Date().toISOString();
  const actor = actorLabel(input.actor);
  const rows = input.useLiveRates
    ? [
        { key: "fx_use_live_rates", value: "true", updated_at: now },
        { key: "fx_manual_rates_json", value: "{}", updated_at: now },
        { key: "fx_manual_rate_reason", value: "", updated_at: now },
        { key: "fx_manual_rate_set_by", value: "", updated_at: now },
        { key: "fx_manual_rate_set_at", value: "", updated_at: now },
      ]
    : [
        { key: "fx_use_live_rates", value: "false", updated_at: now },
        {
          key: "fx_manual_rates_json",
          value: buildManualRatesJson(input.ghsRate!),
          updated_at: now,
        },
        { key: "fx_manual_rate_reason", value: input.reason!.trim(), updated_at: now },
        { key: "fx_manual_rate_set_by", value: actor, updated_at: now },
        { key: "fx_manual_rate_set_at", value: now, updated_at: now },
      ];

  const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
  if (error) {
    return { ok: false as const, message: error.message };
  }

  try {
    revalidateSiteSettings();
    revalidateTag(EXCHANGE_RATES_CACHE_TAG, { expire: 0 });
  } catch {
    // ignore
  }

  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  const auth = await requireFinanceAccess();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const scope = req.nextUrl.searchParams.get("scope") ?? "document";
  if (scope === "platform") {
    const status = await readPlatformOverrideStatus();
    const effective = await getServerExchangeRates();
    return NextResponse.json({
      ok: true,
      scope: "platform",
      status,
      effectiveRate: effective.rates.GHS ?? null,
    });
  }

  const entityType = req.nextUrl.searchParams.get("entityType") ?? "";
  const entityId = req.nextUrl.searchParams.get("entityId") ?? "";
  if (!isFxEntityType(entityType) || !entityId) {
    return NextResponse.json(
      { ok: false, message: "entityType and entityId are required for document scope." },
      { status: 400 }
    );
  }

  const snapshot = await loadFxSnapshot(entityType, entityId);
  return NextResponse.json({ ok: true, snapshot, label: snapshot ? FX_MANUAL_LABEL : null });
}

export async function POST(req: NextRequest) {
  const auth = await requireFinanceAccess();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON." }, { status: 400 });
  }

  const scope = String(body.scope ?? "document");

  if (scope === "platform") {
    const action = String(body.action ?? "set");

    if (action === "clear") {
      const result = await persistPlatformOverride({
        useLiveRates: true,
        actor: auth.auth,
      });
      if (!result.ok) {
        return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
      }

      enqueueAuditLog({
        action: "fx_rate_override",
        success: true,
        actor: auth.auth,
        targetType: "exchange_rates",
        targetId: "platform-display",
        request: req,
        metadata: { scope: "platform", action: "clear", label: FX_ADMIN_OVERRIDE_LABEL },
      });

      const status = await readPlatformOverrideStatus();
      return NextResponse.json({
        ok: true,
        scope: "platform",
        action: "clear",
        status,
        message: "Storefront now uses the live market rate.",
      });
    }

    const rateUsed = Number(body.rateUsed);
    const reason = String(body.reason ?? "").trim();
    if (!Number.isFinite(rateUsed) || rateUsed <= 0) {
      return NextResponse.json(
        { ok: false, message: "Override rate must be a positive number." },
        { status: 400 }
      );
    }
    if (reason.length < 3) {
      return NextResponse.json(
        { ok: false, message: "A reason (min 3 characters) is required." },
        { status: 400 }
      );
    }

    const result = await persistPlatformOverride({
      useLiveRates: false,
      ghsRate: rateUsed,
      reason,
      actor: auth.auth,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
    }

    enqueueAuditLog({
      action: "fx_rate_override",
      success: true,
      actor: auth.auth,
      targetType: "exchange_rates",
      targetId: "platform-display",
      request: req,
      metadata: {
        scope: "platform",
        action: "set",
        rateUsed,
        reason,
        label: FX_ADMIN_OVERRIDE_LABEL,
      },
    });

    const status = await readPlatformOverrideStatus();
    return NextResponse.json({
      ok: true,
      scope: "platform",
      action: "set",
      status,
      label: FX_ADMIN_OVERRIDE_LABEL,
      message: "Manual display rate saved. Storefront prices use this rate until you revert.",
    });
  }

  const entityType = String(body.entityType ?? "");
  const entityId = String(body.entityId ?? "").trim();
  const rateUsed = Number(body.rateUsed);
  const reason = String(body.reason ?? "");
  const originalAmountUsd = Number(body.originalAmountUsd);
  const targetCurrency = String(body.targetCurrency ?? "GHS").toUpperCase();

  if (!isFxEntityType(entityType) || !entityId) {
    return NextResponse.json(
      { ok: false, message: "A document type and id are required." },
      { status: 400 }
    );
  }
  if (!isValidCurrencyCode(targetCurrency)) {
    return NextResponse.json({ ok: false, message: "Invalid currency code." }, { status: 400 });
  }
  if (!Number.isFinite(rateUsed) || rateUsed <= 0) {
    return NextResponse.json(
      { ok: false, message: "Override rate must be a positive number." },
      { status: 400 }
    );
  }

  const result = await overrideFxSnapshot({
    entityType,
    entityId,
    rateUsed,
    reason,
    actorId: auth.auth.type === "user" ? auth.auth.userId ?? null : "owner",
    actorName: auth.auth.name,
    originalAmountUsd: Number.isFinite(originalAmountUsd) ? originalAmountUsd : undefined,
  });

  enqueueAuditLog({
    action: "fx_rate_override",
    success: result.ok,
    actor: auth.auth,
    targetType: entityType,
    targetId: entityId,
    request: req,
    errorMessage: result.ok ? null : result.message,
    metadata: { rateUsed, reason, label: FX_MANUAL_LABEL },
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    snapshot: result.snapshot,
    label: FX_MANUAL_LABEL,
  });
}
