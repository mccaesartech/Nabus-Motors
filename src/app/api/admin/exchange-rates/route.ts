import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  isDisplayOverrideActive,
  parseManualRatesJson,
} from "@/lib/currency/rates";
import {
  getMarketExchangeRates,
  getServerExchangeRates,
  refreshServerExchangeRates,
} from "@/lib/currency/server-rates";
import { getAdminSiteSettings } from "@/lib/platform/site-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const settings = await getAdminSiteSettings();
  const live = await getMarketExchangeRates();
  const effective = await getServerExchangeRates();

  return NextResponse.json({
    ok: true,
    live: {
      rates: live.rates,
      source: live.source,
      stale: live.stale,
      fetchedAt: live.fetchedAt,
      rateDate: live.rateDate,
      provider: live.provider,
      error: live.error,
    },
    effective: {
      rates: effective.rates,
      source: effective.source,
      stale: effective.stale,
      fetchedAt: effective.fetchedAt,
      provider: effective.provider,
      displayOverride: effective.displayOverride,
    },
    override: {
      active: isDisplayOverrideActive(settings),
      rates: parseManualRatesJson(settings.fx_manual_rates_json),
      reason: settings.fx_manual_rate_reason || null,
      setBy: settings.fx_manual_rate_set_by || null,
      setAt: settings.fx_manual_rate_set_at || null,
    },
  });
}

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  await refreshServerExchangeRates();
  const live = await getMarketExchangeRates();
  const effective = await getServerExchangeRates();

  return NextResponse.json({
    ok: true,
    live: {
      rates: live.rates,
      source: live.source,
      stale: live.stale,
      fetchedAt: live.fetchedAt,
      rateDate: live.rateDate,
      provider: live.provider,
      error: live.error,
    },
    effective: {
      rates: effective.rates,
      source: effective.source,
      stale: effective.stale,
      fetchedAt: effective.fetchedAt,
      provider: effective.provider,
      displayOverride: effective.displayOverride,
    },
  });
}