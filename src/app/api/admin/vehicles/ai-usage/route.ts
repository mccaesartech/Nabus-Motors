import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import {
  AI_USAGE_ACTIONS,
  AI_USAGE_ACTION_LABELS,
  AI_USAGE_LOG_TABLE,
  AI_USAGE_MIGRATION_REQUIRED_MESSAGE,
  type AiUsageLogRow,
  type AiUsageStatus,
} from "@/lib/ai/usage-log";
import {
  isMissingRelationError,
  isSchemaMissing,
  markSchemaMissing,
  markSchemaPresent,
  SCHEMA_CAPS,
} from "@/lib/observability/schema-capability";
import {
  canDirectMutate,
  MUTATION_APPROVAL_REQUIRED_MESSAGE,
} from "@/lib/platform/mutation-approval";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 500;

function isTableMissing(error: { code?: string | null; message?: string | null }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    isMissingRelationError(error.message, AI_USAGE_LOG_TABLE)
  );
}

function migrationResponse(extra: Record<string, unknown> = {}) {
  return NextResponse.json({
    ok: true,
    configured: true,
    migrationRequired: true,
    message: AI_USAGE_MIGRATION_REQUIRED_MESSAGE,
    logs: [],
    actions: [...AI_USAGE_ACTIONS],
    actionLabels: AI_USAGE_ACTION_LABELS,
    canPermanentlyDelete: false,
    ...extra,
  });
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission("inventory");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const canPurge = canDirectMutate(auth.auth.role) || auth.auth.type === "owner";
  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      configured: false,
      logs: [],
      actions: [...AI_USAGE_ACTIONS],
      actionLabels: AI_USAGE_ACTION_LABELS,
      canPermanentlyDelete: canPurge,
    });
  }

  if (isSchemaMissing(SCHEMA_CAPS.aiUsageLogs)) {
    return migrationResponse({ canPermanentlyDelete: canPurge });
  }

  const params = req.nextUrl.searchParams;
  const vehicleId = params.get("vehicleId")?.trim() ?? "";
  const action = params.get("action")?.trim() ?? "";
  const status = params.get("status")?.trim() ?? "";
  const q = params.get("q")?.trim() ?? "";
  const includeDeleted = params.get("includeDeleted") === "1" && canPurge;
  const limit = Math.min(Number(params.get("limit") ?? 200) || 200, MAX_LIMIT);

  let query = supabase
    .from(AI_USAGE_LOG_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!includeDeleted) {
    query = query.is("deleted_at", null);
  }
  if (vehicleId) query = query.eq("vehicle_id", vehicleId);
  if (action) query = query.eq("action", action);
  if (status === "success" || status === "error" || status === "partial") {
    query = query.eq("status", status);
  }
  if (q) {
    const safe = q.replace(/[(),.*"\\%]/g, " ").trim();
    if (safe) {
      query = query.or(
        `actor_name.ilike."%${safe}%",vehicle_label.ilike."%${safe}%",preview_snippet.ilike."%${safe}%",action.ilike."%${safe}%"`
      );
    }
  }

  const { data, error } = await query;
  if (error) {
    if (isTableMissing(error)) {
      markSchemaMissing(SCHEMA_CAPS.aiUsageLogs);
      return migrationResponse({ canPermanentlyDelete: canPurge });
    }
    return NextResponse.json(
      { ok: false, message: "Could not load AI usage history." },
      { status: 500 }
    );
  }

  markSchemaPresent(SCHEMA_CAPS.aiUsageLogs);

  const logs = ((data ?? []) as AiUsageLogRow[]).map((row) => ({
    ...row,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : {},
  }));

  return NextResponse.json({
    ok: true,
    configured: true,
    migrationRequired: false,
    logs,
    actions: [...AI_USAGE_ACTIONS],
    actionLabels: AI_USAGE_ACTION_LABELS,
    canPermanentlyDelete: canPurge,
    canSoftDelete: true,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission("inventory_edit");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const canPurge = canDirectMutate(auth.auth.role) || auth.auth.type === "owner";

  let body: { ids?: unknown; mode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  if (!ids.length) {
    return NextResponse.json({ ok: false, message: "No history entries selected." }, { status: 400 });
  }

  const mode = body.mode === "permanent" ? "permanent" : "soft";
  if (mode === "permanent" && !canPurge) {
    return NextResponse.json(
      { ok: false, message: MUTATION_APPROVAL_REQUIRED_MESSAGE },
      { status: 403 }
    );
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Database not configured." }, { status: 503 });
  }

  if (isSchemaMissing(SCHEMA_CAPS.aiUsageLogs)) {
    return NextResponse.json(
      { ok: false, migrationRequired: true, message: AI_USAGE_MIGRATION_REQUIRED_MESSAGE },
      { status: 503 }
    );
  }

  if (mode === "permanent") {
    const { error, count } = await supabase
      .from(AI_USAGE_LOG_TABLE)
      .delete({ count: "exact" })
      .in("id", ids);

    if (error) {
      if (isTableMissing(error)) {
        markSchemaMissing(SCHEMA_CAPS.aiUsageLogs);
        return NextResponse.json(
          { ok: false, migrationRequired: true, message: AI_USAGE_MIGRATION_REQUIRED_MESSAGE },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { ok: false, message: "Could not permanently delete AI history." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "permanent",
      deleted: count ?? ids.length,
    });
  }

  const { error, count } = await supabase
    .from(AI_USAGE_LOG_TABLE)
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .in("id", ids)
    .is("deleted_at", null);

  if (error) {
    if (isTableMissing(error)) {
      markSchemaMissing(SCHEMA_CAPS.aiUsageLogs);
      return NextResponse.json(
        { ok: false, migrationRequired: true, message: AI_USAGE_MIGRATION_REQUIRED_MESSAGE },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { ok: false, message: "Could not discard AI history entries." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    mode: "soft",
    deleted: count ?? ids.length,
  });
}

/** Status helper exported for tests / typed clients. */
export type { AiUsageStatus };
