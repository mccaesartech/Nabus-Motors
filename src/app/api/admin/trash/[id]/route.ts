import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { permanentlyDeleteTrashEntry } from "@/lib/platform/trash";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  if (auth.auth.type !== "owner" && auth.auth.role !== "owner") {
    return NextResponse.json(
      { ok: false, message: "Only the owner can permanently delete items." },
      { status: 403 }
    );
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
  }

  const result = await permanentlyDeleteTrashEntry(supabase, auth.auth, id);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.status ?? 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
