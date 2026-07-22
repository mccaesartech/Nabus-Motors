import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { summarizeRecordForLog } from "@/lib/security/safe-logging";

const OPTIONAL_COLUMN_GROUPS: string[][] = [
  ["vehicle_slug", "vehicle_title", "vehicle_price_usd", "payment_status"],
  ["user_id", "customer_registration_id"],
  ["shipping_handling", "shipping_terms_accepted", "shipping_terms_accepted_at"],
  ["reference_code", "customer_registration_id"],
  [
    "is_custom_request",
    "requested_make",
    "requested_model",
    "requested_year",
    "requested_specs",
    "budget_min",
    "budget_max",
    "matched_vehicle_id",
  ],
  ["whatsapp_opt_in"],
];

const CORE_PREORDER_COLUMNS = [
  "vehicle_id",
  "name",
  "email",
  "phone",
  "message",
  "down_payment_usd",
  "status",
  "source",
] as const;

function isForeignKeyError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("foreign key") || lower.includes("violates foreign key");
}

function isMissingColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("column") && lower.includes("does not exist");
}

function isTriggerError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    (lower.includes("record") && lower.includes("not assigned")) ||
    lower.includes("notify_admin_inquiry")
  );
}

function pickCoreRow(
  row: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      next[key] = row[key];
    }
  }
  return next;
}

function omitKeys(row: Record<string, unknown>, keys: string[]) {
  const next = { ...row };
  for (const key of keys) delete next[key];
  return next;
}

/** Drop null/undefined optional fields so FK and schema-cache errors are less likely. */
function compactRow(row: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== null && value !== undefined) {
      next[key] = value;
    }
  }
  return next;
}

export async function insertRow(
  table: string,
  row: Record<string, unknown>
): Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }> {
  const supabase = createAdminSupabase() ?? createServerSupabase();

  if (!supabase) {
    console.info(`[inquiry:${table}] database unavailable; payload omitted`, {
      table,
      ...summarizeRecordForLog(row),
    });
    return { ok: true };
  }

  let currentRow = compactRow(row);
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= OPTIONAL_COLUMN_GROUPS.length; attempt++) {
    const { data, error } = await supabase.from(table).insert(currentRow).select("*").single();

    if (!error) return { ok: true, data: (data as Record<string, unknown> | null) ?? undefined };

    lastError = error.message;

    if (isForeignKeyError(lastError) && "user_id" in currentRow) {
      console.warn(`[inquiry:${table}] FK error, retrying without user_id:`, lastError);
      currentRow = omitKeys(currentRow, ["user_id", "customer_registration_id"]);
      continue;
    }

    const group = OPTIONAL_COLUMN_GROUPS[attempt];
    if (!group?.some((key) => key in row)) break;

    console.warn(
      `[inquiry:${table}] insert attempt ${attempt + 1} failed:`,
      error.message
    );
    currentRow = omitKeys(currentRow, group);
  }

  if (
    table === "preorder_inquiries" &&
    lastError &&
    (isMissingColumnError(lastError) || isTriggerError(lastError) || isForeignKeyError(lastError))
  ) {
    const coreRow = pickCoreRow(row, CORE_PREORDER_COLUMNS);
    const { data, error } = await supabase.from(table).insert(coreRow).select("*").single();
    if (!error) {
      console.warn(`[inquiry:${table}] core-column fallback succeeded`);
      return { ok: true, data: (data as Record<string, unknown> | null) ?? undefined };
    }
    lastError = error.message;
    console.error(`[inquiry:${table}] core-column fallback failed:`, lastError);
  }

  console.error(`[inquiry:${table}] insert failed:`, lastError);
  return { ok: false, error: lastError };
}

export function jsonOk(
  message = "Submitted successfully",
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ ok: true, message, ...extra });
}

export function jsonError(message: string, status = 500, headers?: HeadersInit) {
  return NextResponse.json({ ok: false, message }, { status, headers });
}
