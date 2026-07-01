import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/platform/inquiry-notifications";
import { generateFreightReferenceCode } from "@/lib/platform/freight-reference";
import { notifyCustomer, resolveWhatsAppPreferred } from "@/lib/notifications/customer-notify";
import { formatCustomerNotificationFeedback } from "@/lib/notifications/notification-status";
import { FREIGHT_QUOTE_STATUSES } from "@/lib/platform/shipment";

export async function GET() {
  const auth = await requirePermission("freight");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, configured: false, quotes: [] });
  }

  const { data, error } = await supabase
    .from("freight_quote_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message,
        tableMissing: isMissingTableError(error.message, "freight_quote_requests"),
      },
      { status: 500 }
    );
  }

  const quotes = data ?? [];
  const missingShipmentLink = quotes.filter((q) => !q.converted_shipment_id);
  if (missingShipmentLink.length > 0) {
    const quoteIds = missingShipmentLink.map((q) => q.id);
    const { data: shipments } = await supabase
      .from("shipment_tracking")
      .select("id, reference_id")
      .eq("reference_type", "freight")
      .in("reference_id", quoteIds);

    const shipmentByQuote = new Map(
      (shipments ?? []).map((s) => [s.reference_id as string, s.id as string])
    );

    for (const quote of quotes) {
      if (!quote.converted_shipment_id) {
        const shipmentId = shipmentByQuote.get(quote.id);
        if (shipmentId) {
          quote.converted_shipment_id = shipmentId;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, configured: true, quotes });
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("freight");
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
    return NextResponse.json({ ok: false, message: "Quote id is required." }, { status: 400 });
  }

  const { data: quote, error } = await supabase
    .from("freight_quote_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !quote) {
    return NextResponse.json(
      { ok: false, message: error?.message ?? "Quote not found." },
      { status: error ? 500 : 404 }
    );
  }

  let referenceCode = (quote.reference_code as string | null)?.trim() || "";
  if (!referenceCode) {
    referenceCode = generateFreightReferenceCode();
    await supabase
      .from("freight_quote_requests")
      .update({ reference_code: referenceCode })
      .eq("id", id);
  }

  const isConsultation = String(quote.message ?? "").includes("[Shipping consultation]");
  const whatsappPreferred = resolveWhatsAppPreferred(
    quote.phone as string | null,
    quote.whatsapp_opt_in ?? undefined
  );

  const notifyResult = await notifyCustomer({
    email: String(quote.email ?? "").trim(),
    phone: (quote.phone as string | null)?.trim() || null,
    whatsappPreferred,
    customerName: String(quote.name ?? "").trim() || undefined,
    template: isConsultation ? "shipping_consultation_submitted" : "freight_quote_submitted",
    data: { referenceCode },
    sourceTable: "freight_quote_requests",
    sourceId: id,
  });

  const feedback = formatCustomerNotificationFeedback(notifyResult, {
    savedPrefix: `Confirmation resent (reference ${referenceCode})`,
  });

  return NextResponse.json({
    ok: true,
    referenceCode,
    notification: notifyResult,
    notificationMessage: feedback.message,
    notificationVariant: feedback.variant,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission("freight");
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
    return NextResponse.json({ ok: false, message: "Quote id is required." }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status && FREIGHT_QUOTE_STATUSES.includes(body.status)) {
    updates.status = body.status;
  }
  if (typeof body.message === "string") {
    updates.message = body.message;
  }
  if (body.converted_shipment_id !== undefined) {
    updates.converted_shipment_id = body.converted_shipment_id || null;
  }

  const { data, error } = await supabase
    .from("freight_quote_requests")
    .update(updates)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, quote: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission("freight");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, message: "Quote id is required." }, { status: 400 });
  }

  const { error } = await supabase.from("freight_quote_requests").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
