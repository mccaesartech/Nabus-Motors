import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { enrichActivityLog } from "@/lib/platform/activity-enrich";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const auth = await requirePermission("activity");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, configured: false, activity: [] });
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100), 500);
  const userId = req.nextUrl.searchParams.get("user_id");

  let query = supabase
    .from("platform_activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const activity = await enrichActivityLog(data ?? []);

  return NextResponse.json({ ok: true, activity });
}
