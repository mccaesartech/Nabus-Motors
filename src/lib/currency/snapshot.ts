import { convertAmount, roundMoney, roundRate, type ConversionResult } from "./convert";
import type { ExchangeRateMap } from "./rates";
import type { ExchangeRatePayload } from "./fetch-exchange-rates";
import type { ExchangeRateSource } from "./types";
import { FX_MANUAL_LABEL, rateSourceLabel } from "./meta";
import { BASE_CURRENCY, DEFAULT_DISPLAY_CURRENCY } from "./types";

export const FX_ENTITY_TYPES = [
  "sale",
  "parts_order",
  "preorder",
  "expense",
  "quotation",
  "invoice",
  "payment",
] as const;

export type FxEntityType = (typeof FX_ENTITY_TYPES)[number];

export function isFxEntityType(value: string): value is FxEntityType {
  return (FX_ENTITY_TYPES as readonly string[]).includes(value);
}

export type FxSnapshot = {
  entityType: FxEntityType;
  entityId: string;
  sourceCurrency: string;
  targetCurrency: string;
  originalAmount: number;
  rateUsed: number;
  convertedAmount: number;
  retrievedAt: string;
  provider: string;
  source: ExchangeRateSource;
  rateDate: string | null;
  ratesJson: ExchangeRateMap | null;
  isManual: boolean;
  previousLiveRate: number | null;
  overrideReason: string | null;
  overrideActorId: string | null;
  overrideActorName: string | null;
  overrideAt: string | null;
};

export type FxSnapshotInput = {
  entityType: FxEntityType;
  entityId: string;
  originalAmount: number;
  sourceCurrency?: string;
  targetCurrency?: string;
  payload: Pick<
    ExchangeRatePayload,
    "rates" | "source" | "fetchedAt" | "rateDate"
  > & { provider?: string };
};

/** Build an immutable snapshot from a live (or last-good) payload. */
export function buildFxSnapshot(input: FxSnapshotInput): FxSnapshot {
  const sourceCurrency = (input.sourceCurrency ?? BASE_CURRENCY).toUpperCase();
  const targetCurrency = (input.targetCurrency ?? DEFAULT_DISPLAY_CURRENCY).toUpperCase();
  const conversion = convertAmount(
    input.originalAmount,
    sourceCurrency,
    targetCurrency,
    { rates: input.payload.rates }
  );

  return Object.freeze({
    entityType: input.entityType,
    entityId: input.entityId,
    sourceCurrency: conversion.sourceCurrency,
    targetCurrency: conversion.targetCurrency,
    originalAmount: conversion.originalAmount,
    rateUsed: conversion.rate,
    convertedAmount: roundMoney(conversion.convertedAmount),
    retrievedAt: input.payload.fetchedAt,
    provider: input.payload.provider ?? "exchangerate-api",
    source: input.payload.source,
    rateDate: input.payload.rateDate ?? null,
    ratesJson: { ...input.payload.rates },
    isManual: false,
    previousLiveRate: null,
    overrideReason: null,
    overrideActorId: null,
    overrideActorName: null,
    overrideAt: null,
  });
}

export function applyManualOverride(
  snapshot: FxSnapshot,
  input: {
    rateUsed: number;
    reason: string;
    actorId: string | null;
    actorName: string | null;
    at?: string;
  }
): FxSnapshot {
  if (!Number.isFinite(input.rateUsed) || input.rateUsed <= 0) {
    throw new Error("Override rate must be a positive number.");
  }
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new Error("Override reason is required.");
  }

  const rateUsed = roundRate(input.rateUsed);
  const convertedAmount = roundMoney(snapshot.originalAmount * rateUsed);
  const previousLiveRate = snapshot.isManual
    ? snapshot.previousLiveRate ?? snapshot.rateUsed
    : snapshot.rateUsed;

  return Object.freeze({
    ...snapshot,
    rateUsed,
    convertedAmount,
    isManual: true,
    source: "manual" as ExchangeRateSource,
    previousLiveRate,
    overrideReason: reason,
    overrideActorId: input.actorId,
    overrideActorName: input.actorName,
    overrideAt: input.at ?? new Date().toISOString(),
    ratesJson: snapshot.ratesJson
      ? { ...snapshot.ratesJson, [snapshot.targetCurrency]: rateUsed }
      : { USD: 1, [snapshot.targetCurrency]: rateUsed },
  });
}

/** Rates map frozen at snapshot time. Live market changes must not affect this. */
export function ratesMapFromSnapshot(
  snapshot: Pick<FxSnapshot, "sourceCurrency" | "targetCurrency" | "rateUsed" | "ratesJson">
): ExchangeRateMap {
  if (snapshot.ratesJson && Object.keys(snapshot.ratesJson).length > 0) {
    return { USD: 1, ...snapshot.ratesJson };
  }
  if (snapshot.sourceCurrency === BASE_CURRENCY) {
    return { USD: 1, [snapshot.targetCurrency]: snapshot.rateUsed };
  }
  return {
    USD: 1,
    [snapshot.sourceCurrency]: 1 / snapshot.rateUsed,
    [snapshot.targetCurrency]: 1,
  };
}

export function snapshotConversion(
  snapshot: FxSnapshot,
  amount = snapshot.originalAmount
): ConversionResult {
  return convertAmount(amount, snapshot.sourceCurrency, snapshot.targetCurrency, {
    rates: ratesMapFromSnapshot(snapshot),
  });
}

export function snapshotRateLabel(snapshot: Pick<FxSnapshot, "isManual" | "source" | "provider">): string {
  return rateSourceLabel({
    isManual: snapshot.isManual,
    source: snapshot.source,
    providerName: snapshot.provider === "exchangerate-api" ? "ExchangeRate-API" : snapshot.provider,
  });
}

export function isManualRateLabel(label: string): boolean {
  return label === FX_MANUAL_LABEL;
}

export { FX_MANUAL_LABEL };
