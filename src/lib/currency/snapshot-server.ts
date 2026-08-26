import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  SCHEMA_CAPS,
  isMissingRelationError,
  isSchemaMissing,
  markSchemaMissing,
  markSchemaPresent,
} from "@/lib/observability/schema-capability";
import { getServerExchangeRates } from "./server-rates";
import {
  applyManualOverride,
  buildFxSnapshot,
  isFxEntityType,
  ratesMapFromSnapshot,
  type FxEntityType,
  type FxSnapshot,
} from "./snapshot";
import type { ExchangeRateMap } from "./rates";
import type { ExchangeRateSource } from "./types";

export const EXCHANGE_RATE_SNAPSHOTS_TABLE = "exchange_rate_snapshots";

type SnapshotRow = {
  entity_type: string;
  entity_id: string;
  source_currency: string;
  target_currency: string;
  original_amount: number | string;
  rate_used: number | string;
  converted_amount: number | string;
  retrieved_at: string;
  provider: string;
  source: string;
  rate_date: string | null;
  rates_json: ExchangeRateMap | null;
  is_manual: boolean;
  previous_live_rate: number | string | null;
  override_reason: string | null;
  override_actor_id: string | null;
  override_actor_name: string | null;
  override_at: string | null;
};

function isTableMissing(message?: string | null, code?: string | null): boolean {
  if (code === "42P01" || code === "PGRST205") return true;
  return isMissingRelationError(message, EXCHANGE_RATE_SNAPSHOTS_TABLE);
}

function num(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function rowToSnapshot(row: SnapshotRow): FxSnapshot {
  return {
    entityType: row.entity_type as FxEntityType,
    entityId: row.entity_id,
    sourceCurrency: row.source_currency,
    targetCurrency: row.target_currency,
    originalAmount: num(row.original_amount),
    rateUsed: num(row.rate_used),
    convertedAmount: num(row.converted_amount),
    retrievedAt: row.retrieved_at,
    provider: row.provider,
    source: row.source as ExchangeRateSource,
    rateDate: row.rate_date,
    ratesJson: row.rates_json,
    isManual: row.is_manual === true,
    previousLiveRate: row.previous_live_rate == null ? null : num(row.previous_live_rate),
    overrideReason: row.override_reason,
    overrideActorId: row.override_actor_id,
    overrideActorName: row.override_actor_name,
    overrideAt: row.override_at,
  };
}

function snapshotToRow(snapshot: FxSnapshot) {
  return {
    entity_type: snapshot.entityType,
    entity_id: snapshot.entityId,
    source_currency: snapshot.sourceCurrency,
    target_currency: snapshot.targetCurrency,
    original_amount: snapshot.originalAmount,
    rate_used: snapshot.rateUsed,
    converted_amount: snapshot.convertedAmount,
    retrieved_at: snapshot.retrievedAt,
    provider: snapshot.provider,
    source: snapshot.source,
    rate_date: snapshot.rateDate,
    rates_json: snapshot.ratesJson,
    is_manual: snapshot.isManual,
    previous_live_rate: snapshot.previousLiveRate,
    override_reason: snapshot.overrideReason,
    override_actor_id: snapshot.overrideActorId,
    override_actor_name: snapshot.overrideActorName,
    override_at: snapshot.overrideAt,
  };
}

function clientOrAdmin(supabase?: SupabaseClient | null) {
  return supabase ?? createAdminSupabase();
}

export async function loadFxSnapshot(
  entityType: FxEntityType,
  entityId: string,
  supabase?: SupabaseClient | null
): Promise<FxSnapshot | null> {
  if (isSchemaMissing(SCHEMA_CAPS.exchangeRateSnapshots)) return null;
  const client = clientOrAdmin(supabase);
  if (!client) return null;

  const { data, error } = await client
    .from(EXCHANGE_RATE_SNAPSHOTS_TABLE)
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  if (error) {
    if (isTableMissing(error.message, error.code)) {
      markSchemaMissing(SCHEMA_CAPS.exchangeRateSnapshots);
      return null;
    }
    console.error("[fx] load snapshot failed:", error.message);
    return null;
  }

  markSchemaPresent(SCHEMA_CAPS.exchangeRateSnapshots);
  return data ? rowToSnapshot(data as SnapshotRow) : null;
}

export async function loadFxSnapshotsForEntities(
  entityType: FxEntityType,
  entityIds: string[],
  supabase?: SupabaseClient | null
): Promise<Map<string, FxSnapshot>> {
  const map = new Map<string, FxSnapshot>();
  if (entityIds.length === 0) return map;
  if (isSchemaMissing(SCHEMA_CAPS.exchangeRateSnapshots)) return map;
  const client = clientOrAdmin(supabase);
  if (!client) return map;

  const { data, error } = await client
    .from(EXCHANGE_RATE_SNAPSHOTS_TABLE)
    .select("*")
    .eq("entity_type", entityType)
    .in("entity_id", entityIds);

  if (error) {
    if (isTableMissing(error.message, error.code)) {
      markSchemaMissing(SCHEMA_CAPS.exchangeRateSnapshots);
      return map;
    }
    console.error("[fx] load snapshots failed:", error.message);
    return map;
  }

  markSchemaPresent(SCHEMA_CAPS.exchangeRateSnapshots);
  for (const row of data ?? []) {
    const snapshot = rowToSnapshot(row as SnapshotRow);
    map.set(snapshot.entityId, snapshot);
  }
  return map;
}

export async function captureFxSnapshot(input: {
  entityType: FxEntityType;
  entityId: string;
  originalAmountUsd: number;
  supabase?: SupabaseClient | null;
}): Promise<FxSnapshot | null> {
  if (!input.entityId || !isFxEntityType(input.entityType)) return null;
  if (!Number.isFinite(input.originalAmountUsd)) return null;

  const existing = await loadFxSnapshot(input.entityType, input.entityId, input.supabase);
  if (existing) return existing;

  if (isSchemaMissing(SCHEMA_CAPS.exchangeRateSnapshots)) return null;
  const client = clientOrAdmin(input.supabase);
  if (!client) return null;

  const payload = await getServerExchangeRates();
  const snapshot = buildFxSnapshot({
    entityType: input.entityType,
    entityId: input.entityId,
    originalAmount: input.originalAmountUsd,
    payload,
  });

  const { error } = await client
    .from(EXCHANGE_RATE_SNAPSHOTS_TABLE)
    .upsert(snapshotToRow(snapshot), {
      onConflict: "entity_type,entity_id,source_currency,target_currency",
      ignoreDuplicates: true,
    });

  if (error) {
    if (isTableMissing(error.message, error.code)) {
      markSchemaMissing(SCHEMA_CAPS.exchangeRateSnapshots);
      return null;
    }
    console.error("[fx] capture snapshot failed:", error.message);
    return null;
  }

  markSchemaPresent(SCHEMA_CAPS.exchangeRateSnapshots);
  return (await loadFxSnapshot(input.entityType, input.entityId, client)) ?? snapshot;
}

export async function overrideFxSnapshot(input: {
  entityType: FxEntityType;
  entityId: string;
  rateUsed: number;
  reason: string;
  actorId: string | null;
  actorName: string | null;
  originalAmountUsd?: number;
}): Promise<{ ok: true; snapshot: FxSnapshot } | { ok: false; message: string }> {
  if (isSchemaMissing(SCHEMA_CAPS.exchangeRateSnapshots)) {
    return {
      ok: false,
      message: "Run supabase/migrations/099_exchange_rate_snapshots.sql in the Supabase SQL Editor.",
    };
  }

  const client = createAdminSupabase();
  if (!client) {
    return { ok: false, message: "Database is not configured." };
  }

  let snapshot = await loadFxSnapshot(input.entityType, input.entityId, client);
  if (!snapshot) {
    snapshot = await captureFxSnapshot({
      entityType: input.entityType,
      entityId: input.entityId,
      originalAmountUsd: input.originalAmountUsd ?? 0,
      supabase: client,
    });
  }
  if (!snapshot) {
    return { ok: false, message: "Could not load or create an exchange-rate snapshot for this record." };
  }

  try {
    snapshot = applyManualOverride(snapshot, {
      rateUsed: input.rateUsed,
      reason: input.reason,
      actorId: input.actorId,
      actorName: input.actorName,
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Invalid override.",
    };
  }

  const { error } = await client
    .from(EXCHANGE_RATE_SNAPSHOTS_TABLE)
    .update({
      rate_used: snapshot.rateUsed,
      converted_amount: snapshot.convertedAmount,
      source: snapshot.source,
      is_manual: true,
      previous_live_rate: snapshot.previousLiveRate,
      override_reason: snapshot.overrideReason,
      override_actor_id: snapshot.overrideActorId,
      override_actor_name: snapshot.overrideActorName,
      override_at: snapshot.overrideAt,
      rates_json: snapshot.ratesJson
        ? { ...snapshot.ratesJson, [snapshot.targetCurrency]: snapshot.rateUsed }
        : { USD: 1, [snapshot.targetCurrency]: snapshot.rateUsed },
    })
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId);

  if (error) {
    if (isTableMissing(error.message, error.code)) {
      markSchemaMissing(SCHEMA_CAPS.exchangeRateSnapshots);
      return {
        ok: false,
        message: "Run supabase/migrations/099_exchange_rate_snapshots.sql in the Supabase SQL Editor.",
      };
    }
    return { ok: false, message: "Could not save the manual exchange rate." };
  }

  return { ok: true, snapshot };
}

export async function ratesForEntity(
  entityType: FxEntityType,
  entityId: string,
  liveRates: ExchangeRateMap,
  supabase?: SupabaseClient | null
): Promise<ExchangeRateMap> {
  const snapshot = await loadFxSnapshot(entityType, entityId, supabase);
  if (!snapshot) return liveRates;
  return ratesMapFromSnapshot(snapshot);
}

export async function ratesByEntityId(
  entityType: FxEntityType,
  entityIds: string[],
  liveRates: ExchangeRateMap,
  supabase?: SupabaseClient | null
): Promise<Map<string, ExchangeRateMap>> {
  const snapshots = await loadFxSnapshotsForEntities(entityType, entityIds, supabase);
  const map = new Map<string, ExchangeRateMap>();
  for (const id of entityIds) {
    const snapshot = snapshots.get(id);
    map.set(id, snapshot ? ratesMapFromSnapshot(snapshot) : liveRates);
  }
  return map;
}
