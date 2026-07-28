import { NextRequest, NextResponse } from "next/server";
import {
  canManageTrash,
  canPermanentlyDeleteTrash,
  requireAdmin,
} from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  countActiveTrash,
  listTrashEntries,
  normalizeBatchIds,
  permanentlyDeleteTrashEntries,
  restoreTrashEntries,
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

/** Batch permanent delete: body `{ ids: string[] }`. */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  if (!canPermanentlyDeleteTrash(auth.auth)) {
    return NextResponse.json(
      { ok: false, message: "Only the owner or super admin can permanently delete items." },
      { status: 403 }
    );
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = normalizeBatchIds(body.ids);
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, message: "Missing ids" }, { status: 400 });
  }

  const batch = await permanentlyDeleteTrashEntries(supabase, auth.auth, ids);
  if (batch.succeededIds.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message: batch.failed[0]?.message ?? "Could not delete items.",
        failed: batch.failed,
        deletedIds: [],
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    deletedIds: batch.succeededIds,
    failed: batch.failed,
  });
}

/** Batch restore: body `{ ids: string[], vehicleStatus?: string }`. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  if (!canManageTrash(auth.auth)) {
    return NextResponse.json({ ok: false, message: "Access denied." }, { status: 403 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    ids?: unknown;
    vehicleStatus?: string;
  };
  const ids = normalizeBatchIds(body.ids);
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, message: "Missing ids" }, { status: 400 });
  }

  const vehicleStatus = body.vehicleStatus;
  const allowedStatuses = ["available", "pre_order", "sold", "reserved"] as const;
  const restoreOptions =
    vehicleStatus && allowedStatuses.includes(vehicleStatus as (typeof allowedStatuses)[number])
      ? { vehicleStatus: vehicleStatus as (typeof allowedStatuses)[number] }
      : {};

  const batch = await restoreTrashEntries(supabase, auth.auth, ids, restoreOptions);
  if (batch.succeededIds.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message: batch.failed[0]?.message ?? "Could not restore items.",
        failed: batch.failed,
        restoredIds: [],
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    restoredIds: batch.succeededIds,
    failed: batch.failed,
  });
}
