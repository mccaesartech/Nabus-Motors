import { NextRequest, NextResponse } from "next/server";
import { canManageTrash, requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  countActiveTrash,
  listTrashEntries,
  summarizeActiveTrash,
  TRASH_ENTITY_TYPES,
  type TrashEntityType,
} from "@/lib/platform/trash";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  if (!canManageTrash(auth.auth)) {
    return NextResponse.json({ ok: false, message: "Access denied." }, { status: 403 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      configured: false,
      items: [],
      total: 0,
      count: 0,
    });
  }

  const summaryParam = req.nextUrl.searchParams.get("summary");
  if (summaryParam === "1" || summaryParam === "true") {
    const count = await countActiveTrash(supabase);
    return NextResponse.json({ ok: true, configured: true, count });
  }

  const entityTypeParam = req.nextUrl.searchParams.get("entityType") ?? "all";
  const entityType =
    entityTypeParam === "all" || TRASH_ENTITY_TYPES.includes(entityTypeParam as TrashEntityType)
      ? (entityTypeParam as TrashEntityType | "all")
      : "all";

  const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "50");
  const deletedBy = req.nextUrl.searchParams.get("deletedBy") ?? undefined;
  const dateFrom = req.nextUrl.searchParams.get("dateFrom") ?? undefined;
  const dateTo = req.nextUrl.searchParams.get("dateTo") ?? undefined;

  const { items, total } = await listTrashEntries(supabase, {
    entityType,
    deletedBy,
    dateFrom,
    dateTo,
    page: Number.isFinite(page) ? page : 1,
    limit: Number.isFinite(limit) ? limit : 50,
  });

  const trashSummary = await summarizeActiveTrash(supabase);

  return NextResponse.json({
    ok: true,
    configured: true,
    items,
    total,
    count: total,
    summary: trashSummary,
  });
}
