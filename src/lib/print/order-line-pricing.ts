import { formatPlatformPrice } from "@/lib/currency";
import type { ExchangeRateMap } from "@/lib/currency/rates";

export type ResolvedOrderLinePricing = {
  quantity: number;
  unitPriceUsd: number;
  lineTotalUsd: number;
  unitPriceLabel: string;
  lineTotalLabel: string;
};

/** Normalize cart order line pricing for printable invoices. */
export function resolveOrderLinePricing(
  quantity: unknown,
  unitPriceUsd: unknown,
  lineTotalUsd?: unknown,
  rates?: ExchangeRateMap
): ResolvedOrderLinePricing {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const unitRaw = Number(unitPriceUsd);
  const lineRaw = Number(lineTotalUsd);

  const hasUnit = Number.isFinite(unitRaw) && unitRaw > 0;
  const hasLine = Number.isFinite(lineRaw) && lineRaw > 0;

  let unitUsd = hasUnit ? unitRaw : 0;
  let lineUsd = hasLine ? lineRaw : unitUsd * qty;

  if (!hasUnit && hasLine) {
    unitUsd = lineRaw / qty;
    lineUsd = lineRaw;
  } else if (hasUnit && !hasLine) {
    lineUsd = unitUsd * qty;
  }

  const unitPriceLabel =
    unitUsd > 0 ? formatPlatformPrice(unitUsd, rates) : lineUsd > 0 ? formatPlatformPrice(lineUsd / qty, rates) : "—";
  const lineTotalLabel = lineUsd > 0 ? formatPlatformPrice(lineUsd, rates) : unitUsd > 0 ? formatPlatformPrice(unitUsd * qty, rates) : "—";

  return {
    quantity: qty,
    unitPriceUsd: unitUsd > 0 ? unitUsd : lineUsd > 0 ? lineUsd / qty : 0,
    lineTotalUsd: lineUsd > 0 ? lineUsd : unitUsd * qty,
    unitPriceLabel,
    lineTotalLabel,
  };
}
