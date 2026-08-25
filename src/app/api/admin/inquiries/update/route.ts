import { NextRequest, NextResponse } from "next/server";
import { dbFailure } from "@/lib/errors/api";
import { requireDirectMutation } from "@/lib/admin/auth";
import { logPlatformActivity } from "@/lib/platform/activity";
import { notifyCustomerPreorderUpdate } from "@/lib/customer/notifications-server";
import { notifyCustomer } from "@/lib/notifications/customer-notify";
import { customRequestStatusLabel } from "@/lib/platform/custom-request";
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
  const auth = await requireDirectMutation("leads");
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
    return dbFailure(error, {
      module: "api.admin.inquiries.update.PATCH",
      message: "The lead could not be updated. Try again.",
      request: req,
    });
  }

  if (type === "preorder" && updates.status && data) {
    const record = data as {
      user_id?: string | null;
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      whatsapp_opt_in?: boolean | null;
      vehicle_name?: string | null;
      vehicle_title?: string | null;
      requested_make?: string | null;
      requested_model?: string | null;
      requested_year?: string | null;
      is_custom_request?: boolean;
      status: string;
    };
    const isCustom = record.is_custom_request === true;
    const customTitle = [record.requested_year, record.requested_make, record.requested_model]
      .filter(Boolean)
      .join(" ")
      .trim();
    const title =
      record.vehicle_title?.trim() ||
      record.vehicle_name?.trim() ||
      customTitle ||
      (isCustom ? "Your vehicle request" : "Your pre-order");
    await notifyCustomerPreorderUpdate(supabase, {
      userId: record.user_id,
      preorderId: id,
      title,
      status: record.status,
      isCustomRequest: isCustom,
    });

    const statusLabel = isCustom
      ? customRequestStatusLabel(record.status)
      : record.status.replace(/_/g, " ");

    await notifyCustomer({
      email: record.email?.trim() ?? "",
      phone: record.phone?.trim() || null,
      whatsappPreferred:
        record.whatsapp_opt_in === null || record.whatsapp_opt_in === undefined
          ? undefined
          : record.whatsapp_opt_in,
      customerName: record.name?.trim() || undefined,
      template: "preorder_status_update",
      data: {
        updateTitle: title,
        statusLabel,
        isCustomRequest: isCustom ? "true" : "false",
      },
      sourceTable: "preorder_inquiries",
      sourceId: `${id}:${record.status}`,
    });
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
