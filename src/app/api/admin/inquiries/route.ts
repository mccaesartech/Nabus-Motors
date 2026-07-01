import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { fetchPreorderInquiries } from "@/lib/platform/data";
import { fetchAdminOrders } from "@/lib/platform/orders-admin";
import { INQUIRY_TRASH_TYPES, notDeletedFilter, softDeleteEntity } from "@/lib/platform/trash";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  const type = req.nextUrl.searchParams.get("type") ?? "all";

  if (!supabase) {
    return NextResponse.json({
      ok: true,
      configured: false,
      message: "Supabase service role not configured. Inquiries log to server console only.",
      data: { contact: [], finance: [], appraisal: [], vehicle: [], preorder: [], order: [], newsletter: [] },
    });
  }

  const fetchTable = async (table: string, order = "created_at") => {
    const { data } = await notDeletedFilter(supabase.from(table).select("*"))
      .order(order, { ascending: false })
      .limit(100);
    return data ?? [];
  };

  const data: Record<string, unknown[]> = {};

  if (type === "all" || type === "contact") {
    data.contact = await fetchTable("contact_inquiries");
  }
  if (type === "all" || type === "finance") {
    data.finance = await fetchTable("finance_applications");
  }
  if (type === "all" || type === "appraisal") {
    data.appraisal = await fetchTable("appraisal_requests");
  }
  if (type === "all" || type === "vehicle") {
    data.vehicle = await fetchTable("vehicle_inquiries");
  }
  if (type === "all" || type === "preorder") {
    data.preorder = await fetchPreorderInquiries(supabase);
  }
  if (type === "all" || type === "order") {
    const orders = await fetchAdminOrders(supabase);
    data.order = orders.map((order) => ({
      id: order.id,
      name: order.name,
      email: order.email,
      phone: order.phone,
      status: order.status,
      total_usd: order.totalUsd,
      total_label: order.totalLabel,
      notes: order.notes,
      follow_up_notes: order.notes,
      created_at: order.createdAt,
      item_count: order.itemCount,
      vehicle_count: order.vehicleCount,
      part_count: order.partCount,
    }));
  }
  if (type === "all" || type === "newsletter") {
    data.newsletter = await fetchTable("newsletter_subscribers", "subscribed_at");
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, registration_id, first_name, last_name, phone")
    .not("registration_id", "is", null);

  return NextResponse.json({ ok: true, configured: true, data, profiles: profiles ?? [] });
}

const TABLE_MAP: Record<string, string> = {
  contact: "contact_inquiries",
  finance: "finance_applications",
  appraisal: "appraisal_requests",
  vehicle: "vehicle_inquiries",
  preorder: "preorder_inquiries",
  order: "parts_orders",
};

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const type = req.nextUrl.searchParams.get("type");
  const id = req.nextUrl.searchParams.get("id");

  if (!type || !id) {
    return NextResponse.json({ ok: false, message: "Missing type or id" }, { status: 400 });
  }

  const table = TABLE_MAP[type];
  if (!table) {
    return NextResponse.json({ ok: false, message: "Invalid type" }, { status: 400 });
  }

  const trashType = INQUIRY_TRASH_TYPES[type];
  if (!trashType) {
    return NextResponse.json({ ok: false, message: "Invalid type" }, { status: 400 });
  }

  const result = await softDeleteEntity(supabase, auth.auth, trashType, id);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.status ?? 500 }
    );
  }

  await supabase
    .from("admin_notifications")
    .delete()
    .eq("source_table", table)
    .eq("source_id", id);

  return NextResponse.json({ ok: true });
}
