import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { jsonError, jsonOk } from "@/lib/inquiries/server";
import { emailsMatch, phonesMatch } from "@/lib/platform/shipment";
import { isFreightReferenceCode } from "@/lib/platform/freight-reference";
import { consumeRateLimit, requestIp } from "@/lib/security/rate-limit";

type ShipmentRow = {
  id: string;
  tracking_number: string;
  status: string;
  origin_country: string | null;
  destination: string | null;
  estimated_arrival: string | null;
  actual_arrival: string | null;
  vessel_name: string | null;
  container_number: string | null;
  customer_email: string | null;
  reference_type: string;
  reference_id: string | null;
  notes: string | null;
};

async function loadShipmentEvents(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  shipmentId: string
) {
  const { data: events } = await supabase
    .from("shipment_timeline_events")
    .select("event_type, title, description, location, event_at, estimated_completion, admin_comment, attachment_urls")
    .eq("shipment_id", shipmentId)
    .eq("is_customer_visible", true)
    .order("event_at", { ascending: false });

  return events ?? [];
}

function publicShipmentPayload(
  shipment: ShipmentRow,
  events: Awaited<ReturnType<typeof loadShipmentEvents>>
) {
  const customerNotes =
    shipment.notes && shipment.status !== "cancelled" ? shipment.notes : null;

  const { id: _id, customer_email: _email, reference_type: _rt, reference_id: _ri, ...publicShipment } =
    shipment;

  return {
    ...publicShipment,
    admin_notes: customerNotes,
    events,
  };
}

async function verifyShipmentContact(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  shipment: {
    customer_email: string | null;
    reference_type: string;
    reference_id: string | null;
  },
  email: string | null,
  phone: string | null
): Promise<boolean> {
  if (email && emailsMatch(shipment.customer_email, email)) {
    return true;
  }

  if (shipment.reference_type === "preorder" && shipment.reference_id) {
    const { data: preorder } = await supabase
      .from("preorder_inquiries")
      .select("email, phone")
      .eq("id", shipment.reference_id)
      .maybeSingle();

    if (preorder) {
      if (email && emailsMatch(preorder.email, email)) return true;
      if (phone && phonesMatch(preorder.phone, phone)) return true;
    }
  }

  if (shipment.reference_type === "freight" && shipment.reference_id) {
    const { data: quote } = await supabase
      .from("freight_quote_requests")
      .select("email, phone")
      .eq("id", shipment.reference_id)
      .maybeSingle();

    if (quote) {
      if (email && emailsMatch(quote.email, email)) return true;
      if (phone && phonesMatch(quote.phone, phone)) return true;
    }
  }

  return false;
}

function verifyQuoteContact(
  quote: { email: string; phone: string | null },
  email: string | null,
  phone: string | null
): boolean {
  if (email && emailsMatch(quote.email, email)) return true;
  if (phone && phonesMatch(quote.phone, phone)) return true;
  return false;
}

async function resolveShipmentForQuote(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  quote: {
    id: string;
    converted_shipment_id: string | null;
    reference_code: string | null;
    service_type: string;
    status: string;
    origin_country: string | null;
    destination: string | null;
    cargo_description: string | null;
    cargo_size: string | null;
    created_at: string;
  },
  email: string | null,
  phone: string | null
) {
  let shipmentId = quote.converted_shipment_id;

  if (!shipmentId) {
    const { data: linked } = await supabase
      .from("shipment_tracking")
      .select("id")
      .eq("reference_type", "freight")
      .eq("reference_id", quote.id)
      .maybeSingle();
    shipmentId = linked?.id ?? null;
  }

  if (shipmentId) {
    const { data: shipment } = await supabase
      .from("shipment_tracking")
      .select(
        "id, tracking_number, status, origin_country, destination, estimated_arrival, actual_arrival, vessel_name, container_number, customer_email, reference_type, reference_id, notes"
      )
      .eq("id", shipmentId)
      .maybeSingle();

    if (shipment) {
      const verified = await verifyShipmentContact(supabase, shipment, email, phone);
      if (!verified) {
        return { error: "verification_failed" as const };
      }
      const events = await loadShipmentEvents(supabase, shipment.id);
      return {
        type: "shipment" as const,
        shipment: publicShipmentPayload(shipment as ShipmentRow, events),
        quote: {
          reference_code: quote.reference_code,
          status: quote.status,
          service_type: quote.service_type,
        },
      };
    }
  }

  return {
    type: "quote" as const,
    quote: {
      reference_code: quote.reference_code,
      status: quote.status,
      service_type: quote.service_type,
      origin_country: quote.origin_country,
      destination: quote.destination,
      cargo_description: quote.cargo_description,
      cargo_size: quote.cargo_size,
      created_at: quote.created_at,
      message:
        "Your quote is being reviewed. We will contact you when a shipment is booked.",
    },
  };
}

export async function GET(req: NextRequest) {
  const rateLimit = consumeRateLimit("public-tracking", requestIp(req.headers), {
    limit: 30,
    windowMs: 15 * 60_000,
  });
  if (!rateLimit.allowed) {
    return jsonError("Too many tracking attempts. Try again later.", 429, {
      "Retry-After": String(rateLimit.retryAfterSeconds),
    });
  }

  const number = req.nextUrl.searchParams.get("number")?.trim() || null;
  const reference = req.nextUrl.searchParams.get("reference")?.trim() || null;
  const email = req.nextUrl.searchParams.get("email")?.trim() ?? null;
  const phone = req.nextUrl.searchParams.get("phone")?.trim() ?? null;

  if (!number && !reference && !(email && phone)) {
    return jsonError(
      "Enter a tracking number, quote reference, or both email and phone to look up your shipment.",
      400
    );
  }

  if ((number || reference) && !email && !phone) {
    return jsonError("Email or phone is required to verify your shipment or quote.", 400);
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return jsonError("Tracking is temporarily unavailable.", 503);
  }

  if (reference) {
    const normalizedRef = reference.toUpperCase();
    if (!isFreightReferenceCode(normalizedRef)) {
      return jsonError("Invalid reference format. It should look like FQ-2026-ABC123.", 400);
    }

    const { data: quote, error } = await supabase
      .from("freight_quote_requests")
      .select(
        "id, email, phone, reference_code, status, service_type, origin_country, destination, cargo_description, cargo_size, created_at, converted_shipment_id"
      )
      .eq("reference_code", normalizedRef)
      .maybeSingle();

    if (error || !quote) {
      return jsonError("Quote reference not found. Check the code from your confirmation.", 404);
    }

    if (!verifyQuoteContact(quote, email, phone)) {
      return jsonError(
        "We could not verify this reference with the email or phone provided.",
        403
      );
    }

    const resolved = await resolveShipmentForQuote(supabase, quote, email, phone);
    if ("error" in resolved && resolved.error === "verification_failed") {
      return jsonError(
        "We could not verify this shipment with the email or phone provided.",
        403
      );
    }

    return jsonOk("OK", resolved);
  }

  if (email && phone && !number) {
    const normalizedEmail = email.toLowerCase();

    const { data: shipment } = await supabase
      .from("shipment_tracking")
      .select(
        "id, tracking_number, status, origin_country, destination, estimated_arrival, actual_arrival, vessel_name, container_number, customer_email, reference_type, reference_id, notes, updated_at"
      )
      .ilike("customer_email", normalizedEmail)
      .order("updated_at", { ascending: false })
      .limit(20);

    for (const row of shipment ?? []) {
      const verified = await verifyShipmentContact(supabase, row, email, phone);
      if (verified) {
        const events = await loadShipmentEvents(supabase, row.id);
        return jsonOk("OK", {
          type: "shipment",
          shipment: publicShipmentPayload(row as ShipmentRow, events),
        });
      }
    }

    const { data: quotes } = await supabase
      .from("freight_quote_requests")
      .select(
        "id, email, phone, reference_code, status, service_type, origin_country, destination, cargo_description, cargo_size, created_at, converted_shipment_id"
      )
      .ilike("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(10);

    for (const quote of quotes ?? []) {
      if (!verifyQuoteContact(quote, email, phone)) continue;
      const resolved = await resolveShipmentForQuote(supabase, quote, email, phone);
      if (!("error" in resolved)) {
        return jsonOk("OK", resolved);
      }
    }

    return jsonError(
      "No shipments or quotes found for this email and phone. Check your details or sign in to your account.",
      404
    );
  }

  if (!number) {
    return jsonError("Tracking number is required for this lookup.", 400);
  }

  const { data: shipment, error } = await supabase
    .from("shipment_tracking")
    .select(
      "id, tracking_number, status, origin_country, destination, estimated_arrival, actual_arrival, vessel_name, container_number, customer_email, reference_type, reference_id, notes"
    )
    .eq("tracking_number", number)
    .maybeSingle();

  if (error || !shipment) {
    return jsonError("Shipment not found. Check your tracking number and try again.", 404);
  }

  const verified = await verifyShipmentContact(supabase, shipment, email, phone);
  if (!verified) {
    return jsonError(
      "We could not verify this shipment with the email or phone provided. Please check your details and try again.",
      403
    );
  }

  const events = await loadShipmentEvents(supabase, shipment.id);

  return jsonOk("OK", {
    type: "shipment",
    shipment: publicShipmentPayload(shipment as ShipmentRow, events),
  });
}
