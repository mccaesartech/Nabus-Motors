/**
 * Vehicle table column tiers for admin reads/writes.
 * Full select is preferred now that migrations 060–067 are expected;
 * safe/fallback paths remain for soft recovery if a column is absent.
 */

export const CORE_VEHICLE_COLUMNS = [
  "id",
  "slug",
  "make",
  "model",
  "year",
  "trim",
  "price",
  "mileage",
  "fuel_type",
  "transmission",
  "condition",
  "body_type",
  "location",
  "engine_size",
  "color",
  "vin",
  "description",
  "featured",
  "status",
  "images",
  "specs",
  "created_at",
  "updated_at",
] as const;

export const APPROVAL_VEHICLE_COLUMNS = [
  "approval_status",
  "approval_note",
  "pending_changes",
  "submitted_by",
  "reviewed_by",
  "reviewed_at",
] as const;

/** Columns from migrations 060–067; safe to omit when absent in production. */
export const OPTIONAL_VEHICLE_COLUMNS = [
  "gallery",
  "primary_image_url",
  "additional_images",
  "trust_badges",
  "inspection_summary",
  "country_of_origin",
  "financing_available",
  "shipment_available",
  "customs_clearing_available",
  "warranty_notes",
  "walkaround_video_url",
  "available_locally",
  "local_availability_at",
  "price_currency",
  "listed_price",
  "stock_quantity",
] as const;

const OPTIONAL_COLUMN_SET = new Set<string>(OPTIONAL_VEHICLE_COLUMNS);

export const ADMIN_VEHICLE_SELECT_FULL = [
  ...CORE_VEHICLE_COLUMNS,
  ...APPROVAL_VEHICLE_COLUMNS,
  ...OPTIONAL_VEHICLE_COLUMNS,
].join(", ");

export const ADMIN_VEHICLE_SELECT_SAFE = [
  ...CORE_VEHICLE_COLUMNS,
  ...APPROVAL_VEHICLE_COLUMNS,
].join(", ");

/** PATCH pre-read — includes local availability when migrated (067). */
export const ADMIN_PATCH_EXISTING_SELECT =
  "id, slug, approval_status, pending_changes, year, make, model, status, available_locally, local_availability_at, shipment_available";

export const ADMIN_PATCH_EXISTING_SELECT_MINIMAL =
  "id, slug, approval_status, pending_changes, year, make, model, status";

export type AdminVehicleSelectMode = "full" | "safe";

export function adminVehicleSelectColumns(mode: AdminVehicleSelectMode = "full"): string {
  return mode === "full" ? ADMIN_VEHICLE_SELECT_FULL : ADMIN_VEHICLE_SELECT_SAFE;
}

/** PostgREST / Postgres missing-column errors (with or without "schema cache"). */
export function isMissingVehicleColumnError(message?: string | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  const missingColumn =
    lower.includes("does not exist") ||
    lower.includes("schema cache") ||
    lower.includes("could not find the") ||
    lower.includes("unknown column");
  if (!missingColumn) return false;
  return (
    lower.includes("column") ||
    OPTIONAL_VEHICLE_COLUMNS.some((col) => lower.includes(col))
  );
}

export function isMissingOptionalVehicleColumnError(message?: string | null): boolean {
  if (!isMissingVehicleColumnError(message)) return false;
  const lower = message!.toLowerCase();
  return OPTIONAL_VEHICLE_COLUMNS.some((col) => lower.includes(col));
}

export function stripOptionalVehicleColumns(
  row: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...row };
  for (const key of Object.keys(next)) {
    if (OPTIONAL_COLUMN_SET.has(key)) {
      delete next[key];
    }
  }
  const pending = next.pending_changes;
  if (pending && typeof pending === "object" && !Array.isArray(pending)) {
    next.pending_changes = stripOptionalVehicleColumns(pending as Record<string, unknown>);
  }
  return next;
}

/**
 * Normalize optional string columns: blank → null so PATCH can clear values.
 * Soft fallback still strips these keys if the column is absent in the DB.
 */
export function omitEmptyOptionalVehicleFields<T extends Record<string, unknown>>(
  row: T
): T {
  const next = { ...row } as Record<string, unknown>;
  for (const key of [
    "walkaround_video_url",
    "warranty_notes",
    "inspection_summary",
    "country_of_origin",
  ] as const) {
    if (next[key] === undefined) continue;
    const trimmed = String(next[key] ?? "").trim();
    next[key] = trimmed || null;
  }
  return next as T;
}

const OPTIONAL_MIGRATION_HINTS: Record<string, string> = {
  gallery: "060_vehicle_gallery_images.sql",
  primary_image_url: "060_vehicle_gallery_images.sql",
  additional_images: "060_vehicle_gallery_images.sql",
  trust_badges: "062_vehicle_trust_and_filters.sql",
  inspection_summary: "062_vehicle_trust_and_filters.sql",
  country_of_origin: "062_vehicle_trust_and_filters.sql",
  financing_available: "062_vehicle_trust_and_filters.sql",
  shipment_available: "062_vehicle_trust_and_filters.sql",
  customs_clearing_available: "062_vehicle_trust_and_filters.sql",
  warranty_notes: "064_vehicle_warranty_notes.sql",
  walkaround_video_url: "065_vehicle_walkaround_video.sql",
  available_locally: "067_vehicle_interest_local_availability.sql",
  local_availability_at: "067_vehicle_interest_local_availability.sql",
  price_currency: "081_vehicle_price_currency.sql",
  listed_price: "081_vehicle_price_currency.sql",
  stock_quantity: "082_vehicle_stock_quantity.sql",
};

export function optionalVehicleColumnWarning(message: string): string {
  const lower = message.toLowerCase();
  const migrations = new Set<string>();
  for (const col of OPTIONAL_VEHICLE_COLUMNS) {
    if (lower.includes(col)) {
      const hint = OPTIONAL_MIGRATION_HINTS[col];
      if (hint) migrations.add(hint);
    }
  }
  if (migrations.size === 0) {
    migrations.add("scripts/missing-columns-fix.sql");
  }
  const files = [...migrations].map((f) => `supabase/migrations/${f}`).join(", ");
  return `Saved without optional fields — run ${files} (or scripts/missing-columns-fix.sql) in Supabase SQL Editor for full functionality.`;
}

export type VehicleWriteAttempt<T> = {
  data: T | null;
  error: { message: string } | null;
};

/**
 * Run an insert/update with full optional columns; on missing-column errors,
 * retry with optional fields stripped and a safe select list.
 */
export async function vehicleWriteWithOptionalFallback<T>(
  write: (selectColumns: string, payload: Record<string, unknown>) => Promise<VehicleWriteAttempt<T>>,
  payload: Record<string, unknown>
): Promise<{ result: VehicleWriteAttempt<T>; warning?: string }> {
  const prepared = omitEmptyOptionalVehicleFields(payload);
  let result = await write(adminVehicleSelectColumns("full"), prepared);

  if (!result.error || !isMissingOptionalVehicleColumnError(result.error.message)) {
    return { result };
  }

  const warning = optionalVehicleColumnWarning(result.error.message);
  const stripped = stripOptionalVehicleColumns(prepared);
  result = await write(adminVehicleSelectColumns("safe"), stripped);

  return { result, warning };
}
