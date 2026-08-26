import { NextRequest, NextResponse } from "next/server";
import { requireDirectMutation, requirePermission } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { fetchPreorderInquiryById } from "@/lib/platform/data";
import { softDeleteEntity } from "@/lib/platform/trash";
import { softDeleteAdminNotificationsBySource } from "@/lib/platform/admin-notification-trash";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requirePermission("leads");
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const { id } = await context.params;
  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const inquiry = await fetchPreorderInquiryById(supabase, id);
  if (!inquiry) {
    return NextResponse.json({ ok: false, message: "Pre-order not found" }, { status: 404 });
  }

  const { data: linkedSale } = await supabase
    .from("sales")
    .select("id, status, sale_price, created_at")
    .eq("preorder_inquiry_id", id)
    .neq("status", "cancelled")
    .maybeSingle();

  return NextResponse.json({ ok: true, inquiry, linkedSale: linkedSale ?? null });
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await requireDirectMutation("leads");
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const { id } = await context.params;
  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const result = await softDeleteEntity(supabase, auth.auth, "preorder", id);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.status ?? 500 }
    );
  }

  await softDeleteAdminNotificationsBySource(
    supabase,
    auth.auth,
    "preorder_inquiries",
    id
  );

  return NextResponse.json({ ok: true });
}
