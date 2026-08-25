import { NextRequest, NextResponse } from "next/server";
import { dbFailure } from "@/lib/errors/api";
import { requireDirectMutation, requirePermission } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { sendShipmentTrackingEmail } from "@/lib/email/shipment-tracking";
import { notifyShipmentCustomerUpdate, type ShipmentNotifyResult } from "@/lib/notifications/shipment-notify";
import {
  formatCustomerNotificationFeedback,
  type CustomerNotificationPayload,
} from "@/lib/notifications/notification-status";
import { getAdminSiteSettings, parseShipmentUpdateFrequency } from "@/lib/platform/site-settings";
import {
  generateTrackingNumber,
  SHIPMENT_REFERENCE_TYPES,
  SHIPMENT_STATUSES,
  shipmentStatusLabel,
  type ShipmentReferenceType,
} from "@/lib/platform/shipment";

async function loadShipmentWithEvents(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  id: string
) {
  const { data: shipment, error } = await supabase
    .from("shipment_tracking")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !shipment) return { shipment: null, error };

  const { data: events } = await supabase
    .from("shipment_timeline_events")
    .select("*")
    .eq("shipment_id", id)
    .order("event_at", { ascending: false });

  return { shipment: { ...shipment, events: events ?? [] }, error: null };
}

function shipmentNotifyPayload(result: ShipmentNotifyResult | null | undefined): {
  notification: CustomerNotificationPayload | null;
  notificationMessage: string;
  notificationVariant: "success" | "warning" | "neutral";
} {
  if (!result) {
    return {
      notification: null,
      notificationMessage: "",
      notificationVariant: "success",
    };
  }

  if (!result.attempted) {
    const notAttemptedReason =
      result.reason === "no_contact"
        ? "Customer notification not sent (no email or phone on file)"
        : "Customer notification skipped (duplicate within 30 seconds)";
    const feedback = formatCustomerNotificationFeedback(null, {
      savedPrefix: "Saved",
      notAttemptedReason,
    });
    return {
      notification: null,
      notificationMessage: feedback.message,
      notificationVariant: feedback.variant,
    };
  }

  const feedback = formatCustomerNotificationFeedback(result.notification, {
    savedPrefix: "Saved",
  });
  return {
    notification: result.notification,
    notificationMessage: feedback.message,
    notificationVariant: feedback.variant,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission("freight");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, configured: false, shipments: [] });
  }

  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (id) {
    const { shipment, error } = await loadShipmentWithEvents(supabase, id);
    if (error) {
      return dbFailure(error, {
        module: "api.admin.freight.shipments.GET",
        message: "The shipment could not be saved. Try again.",
        request: req,
      });
    }
    if (!shipment) {
      return NextResponse.json({ ok: false, message: "Shipment not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, shipment });
  }

  const referenceType = req.nextUrl.searchParams.get("reference_type")?.trim();
  let query = supabase
    .from("shipment_tracking")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (referenceType) {
    query = query.eq("reference_type", referenceType);
  }

  const { data, error } = await query;
  if (error) {
    return dbFailure(error, {
      module: "api.admin.freight.shipments.GET",
      message: "The shipment could not be saved. Try again.",
      request: req,
    });
  }

  return NextResponse.json({ ok: true, configured: true, shipments: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireDirectMutation("freight");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }
  const adminSupabase = supabase;

  const body = await req.json();

  const referenceType = (body.reference_type ?? "freight") as ShipmentReferenceType;
  if (!SHIPMENT_REFERENCE_TYPES.includes(referenceType)) {
    return NextResponse.json({ ok: false, message: "Invalid reference type." }, { status: 400 });
  }

  const trackingNumber = String(body.tracking_number ?? "").trim() || generateTrackingNumber();
  const status = SHIPMENT_STATUSES.includes(body.status) ? body.status : "pending";

  let linkedUserId = body.user_id ?? null;
  let quoteReferenceCode: string | null = null;
  let customerPhone: string | null = body.customer_phone?.trim() || null;
  let whatsappOptIn: boolean | null =
    body.whatsapp_opt_in === true ? true : body.whatsapp_opt_in === false ? false : null;
  let customerName = body.customer_name?.trim() || null;
  let customerEmail = body.customer_email?.trim() || null;

  if (referenceType === "freight" && body.reference_id) {
    const { data: quote } = await supabase
      .from("freight_quote_requests")
      .select("user_id, reference_code, name, email, phone, whatsapp_opt_in")
      .eq("id", String(body.reference_id))
      .maybeSingle();
    if (quote?.user_id && !linkedUserId) {
      linkedUserId = quote.user_id;
    }
    quoteReferenceCode = quote?.reference_code ?? null;
    customerPhone = customerPhone || quote?.phone?.trim() || null;
    if (whatsappOptIn === null && quote?.whatsapp_opt_in !== undefined && quote?.whatsapp_opt_in !== null) {
      whatsappOptIn = quote.whatsapp_opt_in;
    }
    customerName = customerName || quote?.name?.trim() || null;
    customerEmail = customerEmail || quote?.email?.trim() || null;
  }

  if (referenceType === "preorder" && body.reference_id) {
    const { data: preorder } = await supabase
      .from("preorder_inquiries")
      .select("user_id, name, email, phone, whatsapp_opt_in")
      .eq("id", String(body.reference_id))
      .maybeSingle();
    if (preorder?.user_id && !linkedUserId) {
      linkedUserId = preorder.user_id;
    }
    customerPhone = customerPhone || preorder?.phone?.trim() || null;
    if (whatsappOptIn === null && preorder?.whatsapp_opt_in !== undefined && preorder?.whatsapp_opt_in !== null) {
      whatsappOptIn = preorder.whatsapp_opt_in;
    }
    customerName = customerName || preorder?.name?.trim() || null;
    customerEmail = customerEmail || preorder?.email?.trim() || null;
  }

  const row = {
    tracking_number: trackingNumber,
    reference_type: referenceType,
    reference_id: body.reference_id ?? null,
    user_id: linkedUserId,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    whatsapp_opt_in: whatsappOptIn,
    origin_country: body.origin_country ?? null,
    destination: body.destination ?? "Ghana",
    vessel_name: body.vessel_name ?? null,
    container_number: body.container_number ?? null,
    status,
    estimated_arrival: body.estimated_arrival ?? null,
    actual_arrival: body.actual_arrival ?? null,
    notes: body.notes ?? null,
  };

  const { data, error } = await supabase
    .from("shipment_tracking")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    return dbFailure(error, {
      module: "api.admin.freight.shipments.POST",
      message: "The shipment could not be saved. Try again.",
      request: req,
    });
  }

  if (body.initial_event?.title) {
    await supabase.from("shipment_timeline_events").insert({
      shipment_id: data.id,
      event_type: body.initial_event.event_type ?? "status_update",
      title: body.initial_event.title,
      description: body.initial_event.description ?? null,
      location: body.initial_event.location ?? null,
      event_at: body.initial_event.event_at ?? new Date().toISOString(),
      is_customer_visible: body.initial_event.is_customer_visible !== false,
    });
  }

  let createNotification: ShipmentNotifyResult | null = null;

  if (referenceType === "freight" && body.reference_id) {
    await supabase
      .from("freight_quote_requests")
      .update({
        status: "converted",
        converted_shipment_id: data.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", String(body.reference_id));

    createNotification = await notifyShipmentCustomerUpdate(supabase, data, {
      template: "quote_converted_tracking",
      dedupKey: `converted:${data.id}`,
    });
  }

  if (row.customer_email) {
    void sendShipmentTrackingEmail({
      to: row.customer_email,
      customerName: row.customer_name ?? "Customer",
      trackingNumber,
      referenceCode: quoteReferenceCode,
      originCountry: row.origin_country,
      destination: row.destination,
    });
  }

  const loaded = await loadShipmentWithEvents(supabase, data.id);
  const notifyPayload = shipmentNotifyPayload(createNotification);
  return NextResponse.json({
    ok: true,
    shipment: loaded.shipment ?? data,
    ...notifyPayload,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireDirectMutation("freight");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }
  const adminSupabase = supabase;

  const body = await req.json();
  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, message: "Shipment id is required." }, { status: 400 });
  }

  const { data: before } = await supabase
    .from("shipment_tracking")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!before) {
    return NextResponse.json({ ok: false, message: "Shipment not found." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  const fields = [
    "tracking_number",
    "reference_type",
    "reference_id",
    "user_id",
    "customer_name",
    "customer_email",
    "customer_phone",
    "whatsapp_opt_in",
    "origin_country",
    "destination",
    "vessel_name",
    "container_number",
    "status",
    "estimated_arrival",
    "actual_arrival",
    "notes",
  ] as const;

  for (const field of fields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (updates.status && !SHIPMENT_STATUSES.includes(updates.status as (typeof SHIPMENT_STATUSES)[number])) {
    return NextResponse.json({ ok: false, message: "Invalid status." }, { status: 400 });
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("shipment_tracking").update(updates).eq("id", id);
    if (error) {
      return dbFailure(error, {
        module: "api.admin.freight.shipments.PATCH",
        message: "The shipment could not be saved. Try again.",
        request: req,
      });
    }
  }

  const settings = await getAdminSiteSettings();
  const updateFrequency = parseShipmentUpdateFrequency(settings.shipment_update_frequency);
  const milestonesOnly = updateFrequency === "milestones_only";

  const shipmentRow = {
    ...before,
    ...updates,
    id,
    status: String(updates.status ?? before.status),
  };

  let lastNotification: ShipmentNotifyResult | null = null;

  async function fireCustomerNotify(options: {
    dedupKey?: string;
    skipDedup?: boolean;
    statusNote?: string;
    statusLabel?: string;
  }) {
    lastNotification = await notifyShipmentCustomerUpdate(adminSupabase, shipmentRow, options);
  }

  const statusChanged =
    updates.status !== undefined && String(updates.status) !== String(before.status);
  if (statusChanged) {
    const newStatus = String(updates.status);
    await fireCustomerNotify({
      dedupKey: `status:${newStatus}`,
      statusLabel: shipmentStatusLabel(newStatus),
    });
  }

  const notesChanged =
    updates.notes !== undefined && String(updates.notes ?? "") !== String(before.notes ?? "");
  if (notesChanged && updates.notes && !milestonesOnly) {
    const noteText = String(updates.notes).trim();
    if (noteText) {
      await fireCustomerNotify({
        dedupKey: `notes:${noteText.slice(0, 120)}`,
        skipDedup: true,
        statusNote: noteText,
      });
    }
  }

  if (body.add_event?.title) {
    const isCustomerVisible = body.add_event.is_customer_visible !== false;
    const isMilestone = body.add_event.milestone === true;
    const { error } = await supabase.from("shipment_timeline_events").insert({
      shipment_id: id,
      event_type: body.add_event.event_type ?? "update",
      title: body.add_event.title,
      description: body.add_event.description ?? null,
      location: body.add_event.location ?? null,
      event_at: body.add_event.event_at ?? new Date().toISOString(),
      is_customer_visible: isCustomerVisible,
      estimated_completion: body.add_event.estimated_completion ?? null,
      admin_comment: body.add_event.admin_comment ?? null,
      attachment_urls: Array.isArray(body.add_event.attachment_urls)
        ? body.add_event.attachment_urls.map((u: unknown) => String(u).trim()).filter(Boolean)
        : [],
    });
    if (error) {
      return dbFailure(error, {
        module: "api.admin.freight.shipments.PATCH",
        message: "The shipment could not be saved. Try again.",
        request: req,
      });
    }

    const shouldNotifyEvent = !milestonesOnly || isMilestone;
    if (isCustomerVisible && shouldNotifyEvent) {
      const note = [body.add_event.title, body.add_event.description]
        .filter(Boolean)
        .join(" — ");
      await fireCustomerNotify({
        dedupKey: `event:${body.add_event.title}:${String(note).slice(0, 80)}`,
        skipDedup: true,
        statusNote: note,
      });
    }
  }

  if (body.update_event?.id) {
    const eventUpdates: Record<string, unknown> = {};
    for (const key of [
      "title",
      "description",
      "location",
      "event_at",
      "event_type",
      "is_customer_visible",
      "estimated_completion",
      "admin_comment",
      "attachment_urls",
    ]) {
      if (body.update_event[key] !== undefined) {
        eventUpdates[key] = body.update_event[key];
      }
    }
    if (Object.keys(eventUpdates).length > 0) {
      const { error } = await supabase
        .from("shipment_timeline_events")
        .update(eventUpdates)
        .eq("id", body.update_event.id)
        .eq("shipment_id", id);
      if (error) {
        return dbFailure(error, {
          module: "api.admin.freight.shipments.PATCH",
          message: "The shipment could not be saved. Try again.",
          request: req,
        });
      }
    }
  }

  if (body.delete_event_id) {
    await supabase
      .from("shipment_timeline_events")
      .delete()
      .eq("id", body.delete_event_id)
      .eq("shipment_id", id);
  }

  const loaded = await loadShipmentWithEvents(supabase, id);
  const notifyPayload = shipmentNotifyPayload(lastNotification);
  return NextResponse.json({
    ok: true,
    shipment: loaded.shipment,
    ...notifyPayload,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireDirectMutation("freight");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }
  const adminSupabase = supabase;

  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, message: "Shipment id is required." }, { status: 400 });
  }

  const { error } = await supabase.from("shipment_tracking").delete().eq("id", id);
  if (error) {
    return dbFailure(error, {
      module: "api.admin.freight.shipments.DELETE",
      message: "The shipment could not be saved. Try again.",
      request: req,
    });
  }

  return NextResponse.json({ ok: true });
}
