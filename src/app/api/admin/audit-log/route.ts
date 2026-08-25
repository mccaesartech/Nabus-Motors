import { NextRequest, NextResponse } from "next/server";
import { canViewAuditLog, requireAdmin } from "@/lib/admin/auth";
import { dbFailure } from "@/lib/errors/api";
import {
  AUDIT_ACTIONS,
  AUDIT_LOG_TABLE,
  auditLogToCsv,
  auditLogToPrintableHtml,
  type AuditLogRow,
} from "@/lib/audit";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { enqueueAuditLog } from "@/lib/audit/write";

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

  const rows = (data ?? []) as AuditLogRow[];

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
