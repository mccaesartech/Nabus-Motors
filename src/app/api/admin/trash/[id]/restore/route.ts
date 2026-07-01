import { NextRequest, NextResponse } from "next/server";
import { canManageTrash, requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { restoreTrashEntry } from "@/lib/platform/trash";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
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

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { vehicleStatus?: string };
  const vehicleStatus = body.vehicleStatus;
  const allowedStatuses = ["available", "pre_order", "sold", "reserved"] as const;
  const restoreOptions =
    vehicleStatus && allowedStatuses.includes(vehicleStatus as (typeof allowedStatuses)[number])
      ? { vehicleStatus: vehicleStatus as (typeof allowedStatuses)[number] }
      : {};

  const result = await restoreTrashEntry(supabase, auth.auth, id, restoreOptions);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.status ?? 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
