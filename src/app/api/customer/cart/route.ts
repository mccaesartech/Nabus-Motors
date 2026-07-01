import { NextRequest } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { jsonError, jsonOk } from "@/lib/inquiries/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  deduplicateCartItems,
  isPartLine,
  isVehicleLine,
  normalizeCartLine,
  type CartLineInput,
} from "@/lib/parts/cart-types";

async function getOrCreateCart(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  userId: string
) {
  const existing = await supabase
    .from("customer_carts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.data?.id) return existing.data.id;

  const created = await supabase
    .from("customer_carts")
    .insert({ user_id: userId })
    .select("id")
    .single();

  return created.data?.id ?? null;
}

function mapRowToCartLine(row: {
  item_type?: string | null;
  part_id?: string | null;
  vehicle_id?: string | null;
  quantity: number;
}): CartLineInput | null {
  if (row.item_type === "vehicle" && row.vehicle_id) {
    return {
      itemType: "vehicle",
      vehicleId: row.vehicle_id,
      quantity: row.quantity,
    };
  }

  if (row.part_id) {
    return {
      itemType: "part",
      partId: row.part_id,
      quantity: row.quantity,
    };
  }

  return null;
}

export async function GET(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return jsonOk("Cart loaded.", { items: [] });
  }

  const cartId = await getOrCreateCart(supabase, user.id);
  if (!cartId) {
    return jsonError("Could not load cart.", 500);
  }

  const [itemsResult, cartMeta] = await Promise.all([
    supabase
      .from("cart_items")
      .select("item_type, part_id, vehicle_id, quantity")
      .eq("cart_id", cartId),
    supabase
      .from("customer_carts")
      .select("updated_at")
      .eq("id", cartId)
      .maybeSingle(),
  ]);

  const { data, error } = itemsResult;

  if (error) {
    return jsonError("Could not load cart.", 500);
  }

  const items: CartLineInput[] = deduplicateCartItems(
    (data ?? [])
      .map(mapRowToCartLine)
      .filter((line): line is CartLineInput => line != null)
  );

  const partCount = items.filter((item) => item.itemType === "part").length;
  const vehicleCount = items.filter((item) => item.itemType === "vehicle").length;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return jsonOk("Cart loaded.", {
    items,
    item_count: itemCount,
    part_count: partCount,
    vehicle_count: vehicleCount,
    updated_at: cartMeta.data?.updated_at ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  let body: { items?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request.", 400);
  }

  const items: CartLineInput[] = deduplicateCartItems(
    (body.items ?? [])
      .map(normalizeCartLine)
      .filter((line): line is CartLineInput => line != null)
  );

  const supabase = createAdminSupabase();
  if (!supabase) {
    return jsonOk("Cart saved.");
  }

  const cartId = await getOrCreateCart(supabase, user.id);
  if (!cartId) {
    return jsonError("Could not save cart.", 500);
  }

  await supabase.from("cart_items").delete().eq("cart_id", cartId);

  if (items.length > 0) {
    const rows = items.map((item) => {
      if (isVehicleLine(item)) {
        return {
          cart_id: cartId,
          item_type: "vehicle",
          vehicle_id: item.vehicleId,
          part_id: null,
          quantity: 1,
        };
      }

      return {
        cart_id: cartId,
        item_type: "part",
        part_id: item.partId,
        vehicle_id: null,
        quantity: Math.floor(item.quantity),
      };
    });

    const { error } = await supabase.from("cart_items").insert(rows);
    if (error) {
      return jsonError("Could not save cart.", 500);
    }
  }

  await supabase
    .from("customer_carts")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", cartId);

  return jsonOk("Cart saved.");
}
