import { NextRequest } from "next/server";
import { formatPlatformPrice } from "@/lib/currency";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { resolveCartCheckoutCustomer } from "@/lib/customer/contact-account";
import { insertRow, jsonError, jsonOk } from "@/lib/inquiries/server";
import { formatVehicleName } from "@/lib/format";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchCheckoutVehiclesByIdentifiers } from "@/lib/supabase/vehicles";
import { resolveVehicleCheckoutMode } from "@/lib/vehicles/availability";
import {
  notifyVehicleSaleToLeadsTeam,
  vehicleOrderLeadsLink,
} from "@/lib/platform/vehicle-sale-notifications";
import { notifyCustomerOrderSubmitted } from "@/lib/customer/notifications-server";
import { notifyCustomer } from "@/lib/notifications/customer-notify";
import type { CartPartLine, CartVehicleLine } from "@/lib/parts/cart-types";

type CheckoutPartItem = CartPartLine & {
  partName?: string;
  partSlug?: string;
  sku?: string;
  unitPriceUsd?: number;
};

type CheckoutVehicleItem = CartVehicleLine & {
  vehicleName?: string;
  vehicleSlug?: string;
  unitPriceUsd?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, notes, items, vehicles } = body as {
      name?: string;
      email?: string;
      phone?: string;
      notes?: string;
      items?: CheckoutPartItem[];
      vehicles?: CheckoutVehicleItem[];
    };

    if (!name?.trim() || !email?.trim()) {
      return jsonError("Name and email are required.", 400);
    }

    const partItems = Array.isArray(items) ? items : [];
    const vehicleItems = Array.isArray(vehicles) ? vehicles : [];

    if (partItems.length === 0 && vehicleItems.length === 0) {
      return jsonError("Your cart is empty.", 400);
    }

    const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
    const supabase = createAdminSupabase() ?? createServerSupabase();

    if (!supabase && vehicleItems.length > 0) {
      return jsonError(
        "Vehicle checkout is temporarily unavailable. Please try again shortly.",
        503
      );
    }

    const partIds = partItems.map((item) => item.partId).filter(Boolean);
    const vehicleIds = vehicleItems.map((item) => item.vehicleId).filter(Boolean);

    let partsMap = new Map<
      string,
      {
        id: string;
        name: string;
        slug: string;
        sku: string | null;
        price_usd: number | null;
        stock_quantity: number;
      }
    >();

    let vehiclesMap = new Map<
      string,
      {
        id: string;
        slug: string;
        year: number | null;
        make: string;
        model: string;
        trim: string | null;
        price: number | null;
        status: string | null;
      }
    >();

    if (supabase) {
      if (partIds.length > 0) {
        const { data } = await supabase
          .from("parts")
          .select("id, name, slug, sku, price_usd, stock_quantity")
          .eq("status", "published")
          .in("id", partIds);

        for (const part of data ?? []) {
          partsMap.set(part.id, part);
        }
      }

      if (vehicleIds.length > 0) {
        vehiclesMap = await fetchCheckoutVehiclesByIdentifiers(vehicleIds, supabase);
      }
    }

    const orderItems: Array<{
      item_type: "part" | "vehicle";
      part_id: string | null;
      vehicle_id: string | null;
      part_name: string;
      part_slug: string | null;
      sku: string | null;
      quantity: number;
      unit_price_usd: number;
      item_intent: "buy" | "pre_order" | null;
    }> = [];

    let totalUsd = 0;

    for (const item of partItems) {
      const part = partsMap.get(item.partId);
      if (!part || part.price_usd == null) {
        return jsonError(`Part is no longer available: ${item.partName ?? item.partId}`, 400);
      }

      const quantity = Math.max(1, Math.floor(item.quantity));
      orderItems.push({
        item_type: "part",
        part_id: part.id,
        vehicle_id: null,
        part_name: part.name,
        part_slug: part.slug,
        sku: part.sku,
        quantity,
        unit_price_usd: part.price_usd,
        item_intent: null,
      });
      totalUsd += part.price_usd * quantity;
    }

    for (const item of vehicleItems) {
      const vehicle = vehiclesMap.get(item.vehicleId);
      if (!vehicle) {
        return jsonError(
          `${item.vehicleName ?? "This vehicle"} is no longer in our inventory. Please remove it from your cart or submit a pre-order from the vehicle page.`,
          400
        );
      }
      if (vehicle.status === "sold") {
        return jsonError(
          `${item.vehicleName ?? formatVehicleName({
            year: vehicle.year ?? 0,
            make: vehicle.make,
            model: vehicle.model,
            trim: vehicle.trim ?? undefined,
          })} has been sold. Please remove it from your cart.`,
          400
        );
      }
      if (vehicle.price == null) {
        return jsonError(
          `Vehicle price unavailable: ${item.vehicleName ?? item.vehicleId}`,
          400
        );
      }

      const intent =
        item.intent === "pre_order" || item.intent === "buy" ? item.intent : "buy";

      const checkoutMode = resolveVehicleCheckoutMode(vehicle.status, intent);

      if (checkoutMode === "unavailable") {
        return jsonError(
          `${item.vehicleName ?? "This vehicle"} is no longer available. Please remove it from your cart.`,
          400
        );
      }

      if (intent === "buy" && checkoutMode === "preorder") {
        return jsonError(
          `${item.vehicleName ?? "This vehicle"} is not available for immediate purchase (status: ${vehicle.status ?? "unknown"}). Use the pre-order option in your cart instead.`,
          400
        );
      }

      const quantity = Math.max(1, Math.floor(item.quantity ?? 1));

      orderItems.push({
        item_type: "vehicle",
        part_id: null,
        vehicle_id: vehicle.id,
        part_name: formatVehicleName({
          year: vehicle.year ?? 0,
          make: vehicle.make,
          model: vehicle.model,
          trim: vehicle.trim ?? undefined,
        }),
        part_slug: vehicle.slug,
        sku: null,
        quantity,
        unit_price_usd: vehicle.price,
        item_intent: intent,
      });
      totalUsd += vehicle.price * quantity;
    }

    if (!supabase) {
      console.info("[parts/orders] checkout (no DB)", { name, email, orderItems, totalUsd });
      return jsonOk("Order submitted. Our team will contact you shortly.", {
        orderId: null,
      });
    }

    const checkoutCustomer = await resolveCartCheckoutCustomer({
      authUser: user,
      email: email.trim(),
      name: name.trim(),
      phone: phone?.trim() || undefined,
    });

    const { data: order, error: orderError } = await supabase
      .from("parts_orders")
      .insert({
        user_id: checkoutCustomer.userId ?? user?.id ?? null,
        email: email.trim(),
        name: name.trim(),
        phone: phone?.trim() || null,
        notes: notes?.trim() || null,
        total_usd: totalUsd,
        status: "pending",
      })
      .select("id")
      .single();

    if (orderError || !order) {
      return jsonError("Could not submit order. Please try again.", 500);
    }

    const itemRows = orderItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase.from("parts_order_items").insert(itemRows);
    if (itemsError) {
      await supabase.from("parts_orders").delete().eq("id", order.id);
      return jsonError("Could not submit order. Please try again.", 500);
    }

    const summaryLines = orderItems.map((item) => {
      const unitLabel = formatPlatformPrice(Number(item.unit_price_usd) || 0);
      if (item.item_type === "vehicle") {
        const label = item.item_intent === "pre_order" ? "Pre-order" : "Buy";
        return `• ${item.part_name} (${label}) @ ${unitLabel}`;
      }
      return `• ${item.part_name}${item.sku ? ` (${item.sku})` : ""} × ${item.quantity} @ ${unitLabel}`;
    });

    const orderLabel =
      vehicleItems.length > 0 && partItems.length > 0
        ? "Cart order"
        : vehicleItems.length > 0
          ? "Vehicle cart order"
          : "Parts cart order";

    await insertRow("contact_inquiries", {
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || null,
      subject: `${orderLabel} — ${orderItems.length} item(s)`,
      message: [
        `Order ID: ${order.id}`,
        `Total: ${formatPlatformPrice(totalUsd)}`,
        "",
        ...summaryLines,
        notes?.trim() ? `\nNotes: ${notes.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      status: "new",
    });

    if (user?.id) {
      const cartRow = await supabase
        .from("customer_carts")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cartRow.data?.id) {
        await supabase.from("cart_items").delete().eq("cart_id", cartRow.data.id);
      }
    }

    const vehicleOrderItems = orderItems.filter((item) => item.item_type === "vehicle");
    if (vehicleOrderItems.length > 0) {
      await notifyVehicleSaleToLeadsTeam(supabase, {
        kind: "buy",
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: phone?.trim() || null,
        vehicleTitles: vehicleOrderItems.map((item) => item.part_name),
        referenceId: order.id,
        sourceTable: "parts_orders",
        link: vehicleOrderLeadsLink(order.id),
        totalUsd,
      });
    }

    const orderUserId = checkoutCustomer.userId ?? user?.id ?? null;
    if (orderUserId) {
      await notifyCustomerOrderSubmitted(supabase, {
        userId: orderUserId,
        orderId: order.id,
        itemCount: orderItems.length,
      });
    }

    await notifyCustomer({
      email: email.trim(),
      phone: phone?.trim() || null,
      customerName: name.trim(),
      template: "order_submitted",
      data: { itemCount: String(orderItems.length) },
      sourceTable: "parts_orders",
      sourceId: order.id,
    });

    const hasVehicles = vehicleItems.length > 0;
    const hasParts = partItems.length > 0;
    const message =
      hasVehicles && hasParts
        ? "Order submitted. Our team will confirm pricing, availability, and next steps for your vehicles and parts."
        : hasVehicles
          ? "Order submitted. Our team will contact you about your selected vehicles."
          : "Quote request submitted. Our parts team will contact you shortly.";

    return jsonOk(message, {
      orderId: order.id,
      bookAppointment: hasVehicles,
      vehicles: vehicleOrderItems.map((item) => ({
        id: item.vehicle_id,
        name: item.part_name,
      })),
    });
  } catch {
    return jsonError("Invalid request.", 400);
  }
}
