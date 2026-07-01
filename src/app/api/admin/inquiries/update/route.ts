import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { logPlatformActivity } from "@/lib/platform/activity";
import { createAdminSupabase } from "@/lib/supabase/admin";

const ORDER_STATUSES = ["pending", "confirmed", "shipped", "fulfilled", "cancelled"] as const;

const TABLE_MAP: Record<string, string> = {
  contact: "contact_inquiries",
  finance: "finance_applications",
  appraisal: "appraisal_requests",
  vehicle: "vehicle_inquiries",
  preorder: "preorder_inquiries",
  order: "parts_orders",
};

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Supabase not configured" },
      { status: 503 }
    );
  }

  const { type, id, status, follow_up_notes, source, payment_status, matched_vehicle_id } =
    await req.json();
  const table = TABLE_MAP[type as string];

  if (!table || !id) {
    return NextResponse.json(
      { ok: false, message: "Invalid type or id" },
      { status: 400 }
    );
  }

  const updates: Record<string, string | null> = {};
  if (status) {
    if (type === "order" && !ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])) {
      return NextResponse.json(
        { ok: false, message: "Invalid order status" },
        { status: 400 }
      );
    }
    updates.status = status;
  }
  if (type === "order") {
    if (follow_up_notes !== undefined) updates.notes = follow_up_notes;
  } else if (follow_up_notes !== undefined) {
    updates.follow_up_notes = follow_up_notes;
  }
  if (source && type !== "order") updates.source = source;
  if (payment_status) updates.payment_status = payment_status;
  if (matched_vehicle_id !== undefined && type === "preorder") {
    updates.matched_vehicle_id =
      matched_vehicle_id && String(matched_vehicle_id).trim()
        ? String(matched_vehicle_id).trim()
        : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { ok: false, message: "No fields to update" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from(table)
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  if (payment_status && table === "preorder_inquiries") {
    const { data: notifications } = await supabase
      .from("admin_notifications")
      .select("id, metadata")
      .eq("source_table", table)
      .eq("source_id", id);

    for (const notification of notifications ?? []) {
      const metadata = (notification.metadata as Record<string, unknown>) ?? {};
      await supabase
        .from("admin_notifications")
        .update({
          metadata: { ...metadata, paymentStatus: payment_status },
        })
        .eq("id", notification.id);
    }

  }

  await logPlatformActivity(auth.auth, "lead_updated", `${type}:${id}`, updates);
  return NextResponse.json({ ok: true, record: data });
}
