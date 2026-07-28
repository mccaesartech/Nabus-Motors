import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { checkDbHealth } from "@/lib/supabase/health";
import { reportSchemaIssue } from "@/lib/observability/schema-issue";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const db = await checkDbHealth();

  if (db.error || db.connected === false) {
    reportSchemaIssue({
      table: "db_health",
      migration: "n/a",
      source: "api.admin.health",
      message: db.error ?? "Database not connected",
    });
  }

  const freightMissing = db.tables?.freight_quote_requests === false;
  if (freightMissing) {
    reportSchemaIssue({
      table: "freight_quote_requests",
      migration: "028/036/037",
      source: "api.admin.health",
      message: "freight_quote_requests table missing or unreachable",
    });
  }

  return NextResponse.json({ ok: true, db });
}
