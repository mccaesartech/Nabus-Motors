import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { syncCustomerAccount } from "@/lib/customer/preorder-account";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { ShipmentWithEvents } from "@/lib/platform/shipment";

async function loadShipmentEvents(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  shipmentId: string
) {
  const { data } = await supabase
    .from("shipment_timeline_events")
    .select("id, event_type, title, description, location, event_at, is_customer_visible")
    .eq("shipment_id", shipmentId)
    .eq("is_customer_visible", true)
    .order("event_at", { ascending: false });

  return data ?? [];
}

export async function GET(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user?.email) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, shipments: [], quotes: [], preorders: [] });
  }

  await syncCustomerAccount(user.id, user.email);
  const email = user.email.trim().toLowerCase();

  const [shipmentsRes, quotesRes, preordersRes] = await Promise.all([
    supabase
      .from("shipment_tracking")
      .select(
        "id, tracking_number, reference_type, reference_id, status, origin_country, destination, estimated_arrival, actual_arrival, vessel_name, container_number, notes, created_at, updated_at"
      )
      .or(`user_id.eq.${user.id},customer_email.ilike.${email}`)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("freight_quote_requests")
      .select("id, service_type, origin_country, destination, status, created_at, cargo_description, cargo_size, reference_code, converted_shipment_id")
      .or(`user_id.eq.${user.id},email.ilike.${email}`)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("preorder_inquiries")
      .select(
        "id, status, payment_status, created_at, vehicle_title, vehicle_slug, shipping_handling, vehicle:vehicles(year, make, model, trim, slug)"
      )
      .or(`user_id.eq.${user.id},email.ilike.${email}`)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const shipments: ShipmentWithEvents[] = [];
  for (const row of shipmentsRes.data ?? []) {
    const events = await loadShipmentEvents(supabase, row.id);
    shipments.push({ ...row, events } as ShipmentWithEvents);
  }

  const preorderIds = (preordersRes.data ?? []).map((p) => p.id);
  const linkedByPreorder: Record<string, ShipmentWithEvents> = {};
  for (const shipment of shipments) {
    if (shipment.reference_type === "preorder" && shipment.reference_id) {
      linkedByPreorder[shipment.reference_id] = shipment;
    }
  }

  const preorders = (preordersRes.data ?? []).map((row) => {
    const vehicle = row.vehicle as
      | { year?: number; make?: string; model?: string; trim?: string; slug?: string }
      | null
      | undefined;
    const title =
      row.vehicle_title?.trim() ||
      (vehicle
        ? [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ")
        : "Pre-order");

    return {
      id: row.id,
      title,
      status: row.status,
      payment_status: row.payment_status,
      shipping_handling: row.shipping_handling,
      created_at: row.created_at,
      vehicle_slug: row.vehicle_slug ?? vehicle?.slug ?? null,
      shipment: linkedByPreorder[row.id] ?? null,
    };
  });

  return NextResponse.json({
    ok: true,
    shipments,
    quotes: quotesRes.data ?? [],
    preorders,
    preorderIds,
  });
}
