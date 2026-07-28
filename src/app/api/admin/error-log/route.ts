import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { dbFailure } from "@/lib/errors/api";
import { ERROR_LOG_TABLE } from "@/lib/errors/logger";
import { isErrorId, normalizeErrorId } from "@/lib/errors/error-id";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  errorLogToCsv,
  MIGRATION_REQUIRED_MESSAGE,
  type PlatformErrorLogRow,
} from "@/lib/errors/error-log";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 500;

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
  // `activity` is the existing owner + super_admin audit permission.
  const auth = await requirePermission("activity");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, configured: false, errors: [], modules: [] });
  }

  const params = req.nextUrl.searchParams;
  const search = params.get("q")?.trim() ?? "";
  const severity = params.get("severity")?.trim() ?? "";
  const moduleFilter = params.get("module")?.trim() ?? "";
  const state = params.get("state")?.trim() ?? "";
  const from = params.get("from")?.trim() ?? "";
  const to = params.get("to")?.trim() ?? "";
  const format = params.get("format")?.trim() ?? "";
  const limit = Math.min(Number(params.get("limit") ?? 200) || 200, MAX_LIMIT);

  let query = supabase
    .from(ERROR_LOG_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(format === "csv" ? MAX_LIMIT : limit);

  if (severity) query = query.eq("severity", severity);
  if (moduleFilter) query = query.eq("module", moduleFilter);
  if (state === "resolved") query = query.not("resolved_at", "is", null);
  if (state === "unresolved") query = query.is("resolved_at", null);
  if (from) query = query.gte("created_at", `${from}T00:00:00.000Z`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999Z`);

  if (search) {
    // PostgREST parses `or=(...)` as a mini-language, so strip its delimiters
    // before interpolating operator-supplied text.
    const safe = search.replace(/[(),.*"\\%]/g, " ").trim();
    if (isErrorId(normalizeErrorId(search))) {
      query = query.eq("error_id", normalizeErrorId(search));
    } else if (safe) {
      query = query.or(
        `module.ilike."%${safe}%",user_message.ilike."%${safe}%",internal_message.ilike."%${safe}%"`
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
        errors: [],
        modules: [],
      });
    }
    return dbFailure(error, {
      module: "api.admin.error-log.GET",
      message: "We could not load the error log. Try again.",
      request: req,
      actor: { id: auth.auth.userId, role: auth.auth.role, type: auth.auth.type },
    });
  }

  const rows = (data ?? []) as PlatformErrorLogRow[];

  if (format === "csv") {
    return new NextResponse(errorLogToCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="true-goshen-error-log-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    errors: rows,
    modules: [...new Set(rows.map((row) => row.module))].sort(),
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission("activity");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    errorId?: unknown;
    resolved?: unknown;
    note?: unknown;
  };

  const errorId = typeof body.errorId === "string" ? body.errorId.trim() : "";
  if (!errorId) {
    return NextResponse.json({ ok: false, message: "Missing error ID." }, { status: 400 });
  }

  const resolved = body.resolved !== false;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

  const { error } = await supabase
    .from(ERROR_LOG_TABLE)
    .update({
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by_user_id: resolved && auth.auth.type === "user" ? (auth.auth.userId ?? null) : null,
      resolution_note: resolved ? note : null,
    })
    .eq("error_id", errorId);

  if (error) {
    if (isTableMissing(error)) {
      return NextResponse.json(
        { ok: false, migrationRequired: true, message: MIGRATION_REQUIRED_MESSAGE },
        { status: 503 }
      );
    }
    return dbFailure(error, {
      module: "api.admin.error-log.PATCH",
      message: "That error could not be updated. Try again.",
      request: req,
      actor: { id: auth.auth.userId, role: auth.auth.role, type: auth.auth.type },
    });
  }

  return NextResponse.json({ ok: true });
}
