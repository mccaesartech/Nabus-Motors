import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { PartsOrderItemSummary, PartsOrderSummary } from "@/lib/parts/cart-types";
import { userOrEmailFilter } from "@/lib/security/postgrest-filter";

function firstImage(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0];
  return typeof first === "string" && first.trim() ? first.trim() : null;
}

export async function GET(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user?.email) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, orders: [] });
  }

  const email = user.email.trim().toLowerCase();

  const { data: orders, error } = await supabase
    .from("parts_orders")
    .select(
      "id, status, total_usd, created_at, parts_order_items(id, item_type, part_id, vehicle_id, part_name, part_slug, sku, quantity, unit_price_usd, item_intent)"
    )
    .or(userOrEmailFilter(user.id, email))
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ ok: true, orders: [] });
  }

  const vehicleIds = new Set<string>();
  const partIds = new Set<string>();
  for (const order of orders ?? []) {
    const rawItems = Array.isArray(order.parts_order_items) ? order.parts_order_items : [];
    for (const item of rawItems) {
      if (item.vehicle_id) vehicleIds.add(item.vehicle_id);
      if (item.part_id) partIds.add(item.part_id);
    }
  }

  const vehicleImageById = new Map<string, string | null>();
  const partImageById = new Map<string, string | null>();

  if (vehicleIds.size > 0) {
    const { data: vehicles } = await supabase
      .from("vehicles")
      .select("id, images")
      .in("id", [...vehicleIds]);
    for (const row of vehicles ?? []) {
      vehicleImageById.set(row.id, firstImage(row.images));
    }
  }

  if (partIds.size > 0) {
    const { data: parts } = await supabase
      .from("parts")
      .select("id, images")
      .in("id", [...partIds]);
    for (const row of parts ?? []) {
      partImageById.set(row.id, firstImage(row.images));
    }
  }

  const summaries: PartsOrderSummary[] = (orders ?? []).map((order) => {
    const rawItems = Array.isArray(order.parts_order_items) ? order.parts_order_items : [];
    const items: PartsOrderItemSummary[] = rawItems.map((item) => {
      const itemType = item.item_type === "vehicle" ? "vehicle" : "part";
      const imageUrl =
        itemType === "vehicle" && item.vehicle_id
          ? vehicleImageById.get(item.vehicle_id) ?? null
          : item.part_id
            ? partImageById.get(item.part_id) ?? null
            : null;

      return {
        id: item.id,
        item_type: itemType,
        name: item.part_name,
        slug: item.part_slug,
        sku: item.sku,
        quantity: Number(item.quantity) || 1,
        unit_price_usd: Number(item.unit_price_usd) || 0,
        item_intent:
          item.item_intent === "pre_order" || item.item_intent === "buy"
            ? item.item_intent
            : null,
        vehicle_id: item.vehicle_id ?? null,
        image_url: imageUrl,
      };
    });

    return {
      id: order.id,
      status: order.status,
      total_usd: order.total_usd,
      created_at: order.created_at,
      item_count: items.length,
      items,
    };
  });

  return NextResponse.json({ ok: true, orders: summaries });
}
