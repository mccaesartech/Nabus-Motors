import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/platform/permissions";
import { bucketMovements, runningNetTotals, summarizeMovements } from "@/lib/platform/inventory-movements/aggregate";
import { backfillInventoryMovements, isMovementsTableMissing } from "@/lib/platform/inventory-movements/backfill";
import { resolvePeriodRange } from "@/lib/platform/inventory-movements/period-filters";
import type {
  InventoryMovementRow,
  MovementAssetType,
  MovementDirection,
  MovementPeriod,
} from "@/lib/platform/inventory-movements/types";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { reportSchemaIssue } from "@/lib/observability/schema-issue";

const PERIODS: MovementPeriod[] = ["day", "week", "month", "year", "range"];

function canViewMovements(role: string): boolean {
  return (
    hasPermission(role as "owner", "inventory") ||
    hasPermission(role as "owner", "finance") ||
    hasPermission(role as "owner", "reports")
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  if (!canViewMovements(auth.auth.role)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      configured: false,
      movements: [],
      summary: summarizeMovements([]),
      buckets: [],
    });
  }

  const params = req.nextUrl.searchParams;
  const periodParam = params.get("period") ?? "month";
  const period: MovementPeriod = PERIODS.includes(periodParam as MovementPeriod)
    ? (periodParam as MovementPeriod)
    : "month";
  const from = params.get("from");
  const to = params.get("to");
  const anchorInput = params.get("anchor");
  const anchor = anchorInput ? new Date(anchorInput) : new Date();
  const assetType = params.get("asset_type") as MovementAssetType | "all" | null;
  const direction = params.get("direction") as MovementDirection | "all" | null;
  const shouldBackfill = params.get("backfill") === "1";

  if (shouldBackfill && hasPermission(auth.auth.role, "inventory")) {
    await backfillInventoryMovements(supabase);
  }

  const range = resolvePeriodRange(period, anchor, from, to);

  let query = supabase
    .from("inventory_movements")
    .select("*")
    .gte("occurred_at", range.from.toISOString())
    .lte("occurred_at", range.to.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(500);

  if (assetType && assetType !== "all") {
    query = query.eq("asset_type", assetType);
  }
  if (direction && direction !== "all") {
    query = query.eq("direction", direction);
  }

  const { data, error } = await query;

  if (error) {
    if (isMovementsTableMissing(error.message)) {
      reportSchemaIssue({
        table: "inventory_movements",
        migration: "076_inventory_movements.sql",
        source: "api.admin.inventory-movements",
        message: error.message,
      });
      return NextResponse.json({
        ok: true,
        configured: false,
        migrationRequired: true,
        movements: [],
        summary: summarizeMovements([]),
        buckets: [],
        period,
        range: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        },
      });
    }
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const movements = (data ?? []) as InventoryMovementRow[];
  const summary = summarizeMovements(movements);
  const buckets = bucketMovements(movements, period === "range" ? "day" : period);
  const withRunning = runningNetTotals(movements);

  const { count: totalCount } = await supabase
    .from("inventory_movements")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({
    ok: true,
    configured: true,
    movements: withRunning,
    summary,
    buckets,
    period,
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    },
    totalRecords: totalCount ?? movements.length,
    needsBackfill: (totalCount ?? 0) === 0,
  });
}
