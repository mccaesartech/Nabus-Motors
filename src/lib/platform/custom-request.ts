import { formatAmount } from "@/lib/currency/format";
import { DEFAULT_DISPLAY_CURRENCY } from "@/lib/currency/types";

export type CustomRequestSpecs = {
  body_type?: string;
  fuel_type?: string;
  condition?: string;
  notes?: string;
  preferred_timeline?: string;
};

export const CUSTOM_REQUEST_STATUS_OPTIONS = [
  "reviewing",
  "can_source",
  "cannot_source",
  "matched",
] as const;

export type CustomRequestStatus = (typeof CUSTOM_REQUEST_STATUS_OPTIONS)[number];

export function customRequestStatusLabel(status: string): string {
  switch (status) {
    case "reviewing":
      return "Reviewing";
    case "can_source":
      return "Can source";
    case "cannot_source":
      return "Cannot source";
    case "matched":
      return "Matched to listing";
    default:
      return status.replace(/_/g, " ");
  }
}

export function buildCustomVehicleTitle(
  make?: string | null,
  model?: string | null,
  year?: string | null
): string {
  const parts = [year?.trim(), make?.trim(), model?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Custom vehicle request";
}

export function formatBudgetRangeGhs(
  budgetMin?: number | null,
  budgetMax?: number | null
): string | null {
  if (budgetMin == null && budgetMax == null) return null;
  if (budgetMin != null && budgetMax != null) {
    return `${formatAmount(budgetMin, DEFAULT_DISPLAY_CURRENCY)} – ${formatAmount(budgetMax, DEFAULT_DISPLAY_CURRENCY)}`;
  }
  if (budgetMax != null) {
    return `Up to ${formatAmount(budgetMax, DEFAULT_DISPLAY_CURRENCY)}`;
  }
  return `From ${formatAmount(budgetMin!, DEFAULT_DISPLAY_CURRENCY)}`;
}

export function parseCustomRequestSpecs(value: unknown): CustomRequestSpecs {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  return {
    body_type: row.body_type ? String(row.body_type) : undefined,
    fuel_type: row.fuel_type ? String(row.fuel_type) : undefined,
    condition: row.condition ? String(row.condition) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    preferred_timeline: row.preferred_timeline
      ? String(row.preferred_timeline)
      : undefined,
  };
}
