import { NextRequest, NextResponse } from "next/server";
import { canDeleteAuditLog, canViewAuditLog, requireAdmin } from "@/lib/admin/auth";
import { dbFailure } from "@/lib/errors/api";
import {
  AUDIT_ACTIONS,
  AUDIT_LOG_TABLE,
  auditLogToCsv,
  auditLogToPrintableHtml,
  filterOutTrashedAuditLogs,
  listTrashedAuditLogIds,
  softDeleteAuditLogs,
  type AuditLogRow,
} from "@/lib/audit";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { enqueueAuditLog } from "@/lib/audit/write";
import { normalizeBatchIds } from "@/lib/platform/trash";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 1000;
const MIGRATION_REQUIRED_MESSAGE =
  "Audit logging is not persisted yet. Run supabase/migrations/093_audit_logs.sql in the Supabase SQL Editor.";

async function requireAuditLogAccess() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!canViewAuditLog(auth.auth)) {
    return {
      ok: false as const,
      status: 403,
      message: "You do not have permission to view the audit log.",
      auth: auth.auth,
    };
  }
  return auth;
}

function isTableMissing(error: { code?: string | null; message?: string | null }): boolean {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireAuditLogAccess();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      configured: false,
      logs: [],
      actions: [...AUDIT_ACTIONS],
    });
  }

  const params = req.nextUrl.searchParams;
  const search = params.get("q")?.trim() ?? "";
  const action = params.get("action")?.trim() ?? "";
  const successParam = params.get("success")?.trim() ?? "";
  const actor = params.get("actor")?.trim() ?? "";
  const targetType = params.get("targetType")?.trim() ?? "";
  const from = params.get("from")?.trim() ?? "";
  const to = params.get("to")?.trim() ?? "";
  const format = params.get("format")?.trim() ?? "";
  const limit = Math.min(Number(params.get("limit") ?? 200) || 200, MAX_LIMIT);

  let query = supabase
    .from(AUDIT_LOG_TABLE)
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(format ? MAX_LIMIT : limit);

  if (action) query = query.eq("action", action);
  if (successParam === "true") query = query.eq("success", true);
  if (successParam === "false") query = query.eq("success", false);
  if (targetType) query = query.eq("target_type", targetType);
  if (from) query = query.gte("timestamp", `${from}T00:00:00.000Z`);
  if (to) query = query.lte("timestamp", `${to}T23:59:59.999Z`);

  if (actor) {
    const safe = actor.replace(/[(),.*"\\%]/g, " ").trim();
    if (safe) {
      query = query.or(
        `actor_name.ilike."%${safe}%",actor_role.ilike."%${safe}%",actor_user_id.ilike."%${safe}%"`
      );
    }
  }

  if (search) {
    const safe = search.replace(/[(),.*"\\%]/g, " ").trim();
    if (safe) {
      query = query.or(
        `action.ilike."%${safe}%",actor_name.ilike."%${safe}%",target_name.ilike."%${safe}%",target_id.ilike."%${safe}%",ip_address.ilike."%${safe}%",error_message.ilike."%${safe}%"`
      );
    }
  }

  const { data, error } = await query;

  if (error) {
    if (isTableMissing(error)) {
      return NextResponse.json({
        ok: true,
        configured: true,
        migrationRequired: true,
        message: MIGRATION_REQUIRED_MESSAGE,
        logs: [],
        actions: [...AUDIT_ACTIONS],
      });
    }
    return dbFailure(error, {
      module: "api.admin.audit-log.GET",
      message: "We could not load the audit log. Try again.",
      request: req,
      actor: { id: auth.auth.userId, role: auth.auth.role, type: auth.auth.type },
    });
  }

  const rows = filterOutTrashedAuditLogs(
    (data ?? []) as AuditLogRow[],
    await listTrashedAuditLogIds(supabase)
  );

  if (format === "csv" || format === "xlsx") {
    enqueueAuditLog({
      action: "audit_export",
      success: true,
      actor: auth.auth,
      targetType: "audit_log",
      targetName: `export_${format}`,
      metadata: { format, count: rows.length },
      request: req,
    });
    // Excel opens CSV; no sheetjs dependency in this repo.
    const ext = "csv";
    return new NextResponse(auditLogToCsv(rows), {
      headers: {
        "Content-Type":
          format === "xlsx"
            ? "application/vnd.ms-excel; charset=utf-8"
            : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="true-goshen-audit-log-${new Date()
          .toISOString()
          .slice(0, 10)}.${ext}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (format === "pdf" || format === "html") {
    return new NextResponse(auditLogToPrintableHtml(rows), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    logs: rows,
    actions: [...AUDIT_ACTIONS],
    targetTypes: [...new Set(rows.map((r) => r.target_type).filter(Boolean))].sort(),
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  if (!canDeleteAuditLog(auth.auth)) {
    return NextResponse.json(
      { ok: false, message: "Only the owner or super admin can delete audit log entries." },
      { status: 403 }
    );
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const queryId = req.nextUrl.searchParams.get("id");
  let ids: string[] = [];
  let snapshotsById: Record<string, Record<string, unknown>> | undefined;

  if (queryId?.trim()) {
    ids = [queryId.trim()];
  } else {
    const body = (await req.json().catch(() => ({}))) as {
      ids?: unknown;
      id?: unknown;
      snapshots?: unknown;
    };
    if (typeof body.id === "string" && body.id.trim()) {
      ids = [body.id.trim()];
    } else {
      ids = normalizeBatchIds(body.ids);
    }
    if (body.snapshots && typeof body.snapshots === "object" && !Array.isArray(body.snapshots)) {
      snapshotsById = body.snapshots as Record<string, Record<string, unknown>>;
    }
  }

  if (ids.length === 0) {
    return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
  }

  const batch = await softDeleteAuditLogs(supabase, auth.auth, ids, snapshotsById);

  if (batch.deletedIds.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message: batch.failed[0]?.message ?? "Could not move audit log entry to trash.",
        failed: batch.failed,
        deletedIds: [],
      },
      { status: batch.failed[0]?.message?.includes("not found") ? 404 : 500 }
    );
  }

  enqueueAuditLog({
    action: "audit_log_deleted",
    success: true,
    actor: auth.auth,
    targetType: "audit_log",
    targetName: batch.deletedIds.length === 1 ? batch.deletedIds[0] : `${batch.deletedIds.length} entries`,
    metadata: { count: batch.deletedIds.length, ids: batch.deletedIds },
    request: req,
  });

  return NextResponse.json({
    ok: true,
    deletedIds: batch.deletedIds,
    failed: batch.failed,
    message:
      batch.deletedIds.length === 1
        ? "Audit log entry moved to trash."
        : `${batch.deletedIds.length} audit log entries moved to trash.`,
  });
}
