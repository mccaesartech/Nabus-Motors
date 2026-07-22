import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { canEditInventory } from "@/lib/platform/permissions";
import { hasPermission, type PlatformRole } from "@/lib/platform/permissions";
import { runAdminSearch, runAdminSearchFallback } from "@/lib/admin/run-search";
import {
  MAX_ADMIN_SEARCH_LENGTH,
  SEARCH_TYPE_PERMISSION,
  type AdminSearchResult,
  type AdminSearchResultType,
} from "@/lib/admin/search";
import { createAdminSupabase } from "@/lib/supabase/admin";

function allowedSearchTypes(role: PlatformRole): AdminSearchResultType[] {
  return (Object.keys(SEARCH_TYPE_PERMISSION) as AdminSearchResultType[]).filter(
    (type) => hasPermission(role, SEARCH_TYPE_PERMISSION[type])
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: auth.status });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const full = req.nextUrl.searchParams.get("full") === "1";

  if (q.length < 2) {
    return NextResponse.json({
      ok: true,
      configured: true,
      results: [] satisfies AdminSearchResult[],
      groups: [],
    });
  }
  if (q.length > MAX_ADMIN_SEARCH_LENGTH) {
    return NextResponse.json(
      { ok: false, message: `Search queries are limited to ${MAX_ADMIN_SEARCH_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message: "Search is unavailable — database is not configured.",
        results: [],
        groups: [],
      },
      { status: 503 }
    );
  }

  const allowedTypes = allowedSearchTypes(auth.auth.role);
  const searchOpts = {
    full,
    canEditInventory: canEditInventory(auth.auth.role),
    allowedTypes,
  };

  let payload = await runAdminSearch(supabase, q, searchOpts);

  if (payload.hadError) {
    const fallback = await runAdminSearchFallback(supabase, q, searchOpts);
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
