import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { canEditInventory } from "@/lib/platform/permissions";
import { runAdminSearch, runAdminSearchFallback } from "@/lib/admin/run-search";
import type { AdminSearchResult } from "@/lib/admin/search";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const full = req.nextUrl.searchParams.get("full") === "1";

  if (q.length < 2) {
    return NextResponse.json({
      ok: true,
      results: [] satisfies AdminSearchResult[],
      groups: [],
    });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, configured: false, results: [], groups: [] });
  }

  let payload = await runAdminSearch(supabase, q, {
    full,
    canEditInventory: canEditInventory(auth.auth.role),
  });

  if (payload.hadError) {
    const fallback = await runAdminSearchFallback(supabase, q, {
      full,
      canEditInventory: canEditInventory(auth.auth.role),
    });
    payload = { ...fallback, hadError: false };
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    query: q,
    results: payload.results,
    groups: payload.groups,
  });
}
