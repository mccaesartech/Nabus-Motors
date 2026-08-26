import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  SCHEMA_CAPS,
  isMissingRelationError,
  isSchemaMissing,
  markSchemaMissing,
  markSchemaPresent,
} from "@/lib/observability/schema-capability";
import type { ExchangeRatePayload } from "./fetch-exchange-rates";
import type { ExchangeRateMap } from "./rates";
import type { ExchangeRateSource } from "./types";

export const EXCHANGE_RATE_CACHE_TABLE = "exchange_rate_cache";
const CACHE_ROW_ID = "usd";

type CacheRow = {
  id: string;
  rates: ExchangeRateMap;
  rates_from_ghs: ExchangeRateMap | null;
  source: string;
  provider: string;
  stale: boolean;
  fetched_at: string;
  rate_date: string | null;
};

function isTableMissing(message?: string | null, code?: string | null): boolean {
  if (code === "42P01" || code === "PGRST205") return true;
  return isMissingRelationError(message, EXCHANGE_RATE_CACHE_TABLE);
}

export async function persistLastGoodRates(payload: ExchangeRatePayload): Promise<void> {
  if (payload.stale || payload.source === "fallback") return;
  if (isSchemaMissing(SCHEMA_CAPS.exchangeRateCache)) return;

  try {
    const supabase = createAdminSupabase();
    if (!supabase) return;

    const { error } = await supabase.from(EXCHANGE_RATE_CACHE_TABLE).upsert(
      {
        id: CACHE_ROW_ID,
        rates: payload.rates,
        rates_from_ghs: payload.ratesFromGhs,
        source: payload.source,
        provider: payload.provider,
        stale: false,
        fetched_at: payload.fetchedAt,
        rate_date: payload.rateDate ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      if (isTableMissing(error.message, error.code)) {
        markSchemaMissing(SCHEMA_CAPS.exchangeRateCache);
        return;
      }
      console.error("[fx] persist last-good rates failed:", error.message);
      return;
    }

    markSchemaPresent(SCHEMA_CAPS.exchangeRateCache);
  } catch (error) {
    console.error(
      "[fx] persist last-good rates failed:",
      error instanceof Error ? error.message : error
    );
  }
}

export async function readLastGoodRates(): Promise<ExchangeRatePayload | null> {
  if (isSchemaMissing(SCHEMA_CAPS.exchangeRateCache)) return null;

  try {
    const supabase = createAdminSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from(EXCHANGE_RATE_CACHE_TABLE)
      .select("id, rates, rates_from_ghs, source, provider, stale, fetched_at, rate_date")
      .eq("id", CACHE_ROW_ID)
      .maybeSingle();

    if (error) {
      if (isTableMissing(error.message, error.code)) {
        markSchemaMissing(SCHEMA_CAPS.exchangeRateCache);
        return null;
      }
      console.error("[fx] read last-good rates failed:", error.message);
      return null;
    }

    const row = data as CacheRow | null;
    if (!row?.rates || typeof row.rates !== "object") return null;

    markSchemaPresent(SCHEMA_CAPS.exchangeRateCache);

    return {
      rates: { USD: 1, ...row.rates },
      ratesFromGhs: row.rates_from_ghs ?? { GHS: 1 },
      source: "cache" as ExchangeRateSource,
      stale: true,
      fetchedAt: row.fetched_at,
      rateDate: row.rate_date ?? undefined,
      provider: row.provider || "exchangerate-api",
    };
  } catch (error) {
    console.error(
      "[fx] read last-good rates failed:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
