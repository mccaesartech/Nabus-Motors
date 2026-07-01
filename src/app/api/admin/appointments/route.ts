import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { notifyCustomer } from "@/lib/notifications/customer-notify";
import { formatCustomerNotificationFeedback } from "@/lib/notifications/notification-status";

const APPOINTMENT_STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const;

export async function GET() {
  const auth = await requirePermission("leads");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, configured: false, appointments: [] });
  }

  const { data, error } = await supabase
    .from("vehicle_appointments")
    .select("*, vehicles(year, make, model, slug)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, configured: true, appointments: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission("leads");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const body = await req.json();
  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, message: "Appointment id is required." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  const notifyConfirmed = body.status === "confirmed";
  if (body.status && APPOINTMENT_STATUSES.includes(body.status)) {
    updates.status = body.status;
    if (body.status === "confirmed") {
      updates.confirmed_at = new Date().toISOString();
    }
  }
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.preferred_date !== undefined) updates.preferred_date = body.preferred_date;
  if (body.preferred_time !== undefined) updates.preferred_time = body.preferred_time;
  if (body.branch !== undefined) updates.branch = body.branch;

  const { data, error } = await supabase
    .from("vehicle_appointments")
    .update(updates)
    .eq("id", id)
    .select("*, vehicles(year, make, model, slug)")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  let notificationResult = null;
  if (notifyConfirmed && data?.email) {
    notificationResult = await notifyCustomer({
      email: String(data.email),
      phone: data.phone ? String(data.phone) : null,
      customerName: data.name ? String(data.name) : undefined,
      template: "appointment_confirmed",
      data: {
        appointmentDate: data.preferred_date ? String(data.preferred_date) : undefined,
        branch: data.branch ? String(data.branch) : undefined,
      },
      sourceTable: "vehicle_appointments",
      sourceId: String(data.id),
    });
  }

  const feedback = formatCustomerNotificationFeedback(notificationResult, {
    savedPrefix: "Appointment updated",
  });

  return NextResponse.json({
    ok: true,
    appointment: data,
    notification: notificationResult,
    notificationMessage: notificationResult ? feedback.message : undefined,
    notificationVariant: notificationResult ? feedback.variant : undefined,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission("leads");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, message: "Appointment id is required." }, { status: 400 });
  }

  const { error } = await supabase.from("vehicle_appointments").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
