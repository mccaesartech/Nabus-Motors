import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { notifyCustomer } from "@/lib/notifications/customer-notify";
import { notifyCustomerOrderConfirmed } from "@/lib/customer/notifications-server";
import { formatCustomerNotificationFeedback } from "@/lib/notifications/notification-status";
import { logPlatformActivity } from "@/lib/platform/activity";
import { fetchAdminOrderDetail } from "@/lib/platform/orders-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

const ORDER_STATUSES = ["pending", "confirmed", "shipped", "fulfilled", "cancelled"] as const;

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const { id } = await context.params;
  const order = await fetchAdminOrderDetail(supabase, id);
  if (!order) {
    return NextResponse.json({ ok: false, message: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, order });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const { id } = await context.params;
  const body = await req.json();
  const action = String(body.action ?? "");

  const existing = await fetchAdminOrderDetail(supabase, id);
  if (!existing) {
    return NextResponse.json({ ok: false, message: "Order not found" }, { status: 404 });
  }

  if (action === "confirm") {
    const now = new Date().toISOString();
    const updates: Record<string, string> = {
      status: "confirmed",
      updated_at: now,
      confirmed_at: now,
    };

    let { error } = await supabase.from("parts_orders").update(updates).eq("id", id);

    if (error?.message?.includes("confirmed_at")) {
      ({ error } = await supabase
        .from("parts_orders")
        .update({ status: "confirmed", updated_at: now })
        .eq("id", id));
    }

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    const orderRef = id.slice(0, 8).toUpperCase();
    const notificationResult = await notifyCustomer({
      email: existing.email,
      phone: existing.phone,
      whatsappPreferred: true,
      template: "cart_order_confirmed",
      customerName: existing.name,
      data: {
        orderRef,
        orderTotal: existing.totalLabel,
      },
      sourceTable: "parts_orders",
      sourceId: id,
    });

    await notifyCustomerOrderConfirmed(supabase, {
      userId: existing.userId,
      orderId: id,
      orderRef,
    });

    await logPlatformActivity(auth.auth, "lead_updated", id, {
      action: "order_confirmed",
      customer_email: existing.email,
    });

    const order = await fetchAdminOrderDetail(supabase, id);
    const feedback = formatCustomerNotificationFeedback(notificationResult, {
      savedPrefix: "Order confirmed",
    });
    return NextResponse.json({
      ok: true,
      order,
      notification: notificationResult,
      notificationMessage: feedback.message,
      notificationVariant: feedback.variant,
    });
  }

  const updates: Record<string, string> = {};

  if (typeof body.status === "string" && ORDER_STATUSES.includes(body.status)) {
    updates.status = body.status;
    if (body.status === "confirmed" && existing.status !== "confirmed") {
      updates.confirmed_at = new Date().toISOString();
    }
  }
  if (body.notes !== undefined) {
    updates.notes = String(body.notes ?? "");
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, message: "No fields to update" }, { status: 400 });
  }

  let { data, error } = await supabase
    .from("parts_orders")
    .update(updates)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error?.message?.includes("confirmed_at") && updates.confirmed_at) {
    const { confirmed_at: _drop, ...withoutConfirmed } = updates;
    ({ data, error } = await supabase
      .from("parts_orders")
      .update(withoutConfirmed)
      .eq("id", id)
      .select("id")
      .maybeSingle());
  }

  if (error || !data) {
    return NextResponse.json(
      { ok: false, message: error?.message ?? "Order not found" },
      { status: error ? 500 : 404 }
    );
  }

  if (updates.status === "confirmed" && existing.status !== "confirmed") {
    const orderRef = id.slice(0, 8).toUpperCase();
    const notificationResult = await notifyCustomer({
      email: existing.email,
      phone: existing.phone,
      whatsappPreferred: true,
      template: "cart_order_confirmed",
      customerName: existing.name,
      data: {
        orderRef,
        orderTotal: existing.totalLabel,
      },
      sourceTable: "parts_orders",
      sourceId: id,
    });

    await notifyCustomerOrderConfirmed(supabase, {
      userId: existing.userId,
      orderId: id,
      orderRef,
    });

    const order = await fetchAdminOrderDetail(supabase, id);
    const feedback = formatCustomerNotificationFeedback(notificationResult, {
      savedPrefix: "Order updated",
    });
    return NextResponse.json({
      ok: true,
      order,
      notification: notificationResult,
      notificationMessage: feedback.message,
      notificationVariant: feedback.variant,
    });
  }

  const order = await fetchAdminOrderDetail(supabase, id);
  return NextResponse.json({ ok: true, order });
}
