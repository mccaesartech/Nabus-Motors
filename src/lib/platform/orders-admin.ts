import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPlatformPrice } from "@/lib/currency";
import { getStaticFallbackRates, type ExchangeRateMap } from "@/lib/currency/rates";
import { ratesByEntityId, loadFxSnapshot } from "@/lib/currency/snapshot-server";
import { ratesMapFromSnapshot, type FxSnapshot } from "@/lib/currency/snapshot";
import { notDeletedFilter } from "@/lib/platform/trash-types";

export type AdminOrderItem = {
  id: string;
  itemType: "part" | "vehicle";
  partId: string | null;
  vehicleId: string | null;
  name: string;
  slug: string | null;
  sku: string | null;
  quantity: number;
  unitPriceUsd: number;
  unitPriceLabel: string;
  lineTotalLabel: string;
  itemIntent: "buy" | "pre_order" | null;
  vehicleImageUrl?: string | null;
};

export type AdminOrderAppointment = {
  id: string;
  preferredDate: string | null;
  preferredTime: string | null;
  status: string;
  branch: string | null;
};

export type AdminOrderSummary = {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  totalUsd: number;
  totalLabel: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  itemCount: number;
  vehicleCount: number;
  partCount: number;
};

export type AdminOrderDetail = AdminOrderSummary & {
  items: AdminOrderItem[];
  appointment: AdminOrderAppointment | null;
  fxSnapshot?: FxSnapshot | null;
};

type OrderRow = {
  id: string;
  user_id: string | null;
  email: string;
  name: string;
  phone: string | null;
  status: string;
  total_usd: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at?: string | null;
};

type OrderItemRow = {
  id: string;
  item_type: string;
  part_id: string | null;
  vehicle_id: string | null;
  part_name: string;
  part_slug: string | null;
  sku: string | null;
  quantity: number;
  unit_price_usd: number;
  item_intent: string | null;
};

function mapItem(row: OrderItemRow, rates: ExchangeRateMap): AdminOrderItem {
  const unitPriceUsd = Number(row.unit_price_usd) || 0;
  const quantity = Number(row.quantity) || 1;
  return {
    id: row.id,
    itemType: row.item_type === "vehicle" ? "vehicle" : "part",
    partId: row.part_id,
    vehicleId: row.vehicle_id,
    name: row.part_name,
    slug: row.part_slug,
    sku: row.sku,
    quantity,
    unitPriceUsd,
    unitPriceLabel: formatPlatformPrice(unitPriceUsd, rates),
    lineTotalLabel: formatPlatformPrice(unitPriceUsd * quantity, rates),
    itemIntent:
      row.item_intent === "pre_order" || row.item_intent === "buy"
        ? row.item_intent
        : null,
  };
}

function mapSummary(
  row: OrderRow,
  items: AdminOrderItem[],
  rates: ExchangeRateMap
): AdminOrderSummary {
  const totalUsd = Number(row.total_usd) || 0;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    totalUsd,
    totalLabel: formatPlatformPrice(totalUsd, rates),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at ?? null,
    itemCount: items.length,
    vehicleCount: items.filter((item) => item.itemType === "vehicle").length,
    partCount: items.filter((item) => item.itemType === "part").length,
  };
}

async function attachVehicleImages(
  supabase: SupabaseClient,
  items: AdminOrderItem[]
): Promise<AdminOrderItem[]> {
  const vehicleIds = items
    .filter((item) => item.itemType === "vehicle" && item.vehicleId)
    .map((item) => item.vehicleId as string);

  if (vehicleIds.length === 0) return items;

  const { data } = await supabase
    .from("vehicles")
    .select("id, images")
    .in("id", vehicleIds);

  const imageById = new Map<string, string | null>();
  for (const row of data ?? []) {
    const images = row.images as string[] | null | undefined;
    imageById.set(row.id, images?.[0] ?? null);
  }

  return items.map((item) =>
    item.vehicleId
      ? { ...item, vehicleImageUrl: imageById.get(item.vehicleId) ?? null }
      : item
  );
}

async function fetchOrderAppointment(
  supabase: SupabaseClient,
  orderId: string
): Promise<AdminOrderAppointment | null> {
  const { data } = await supabase
    .from("vehicle_appointments")
    .select("id, preferred_date, preferred_time, status, branch")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    preferredDate: data.preferred_date ?? null,
    preferredTime: data.preferred_time ?? null,
    status: data.status,
    branch: data.branch ?? null,
  };
}

export async function fetchAdminOrders(
  supabase: SupabaseClient,
  options: { limit?: number; rates?: ExchangeRateMap } = {}
): Promise<AdminOrderSummary[]> {
  const { limit = 100, rates = getStaticFallbackRates() } = options;
  const listSelect = `
    id, user_id, email, name, phone, status, total_usd, notes, created_at, updated_at,
    parts_order_items (
      id, item_type, part_id, vehicle_id, part_name, part_slug, sku, quantity, unit_price_usd, item_intent
    )
  `;

  let data: unknown[] | null = null;
  let error: { message: string } | null = null;

  const withConfirmed = await notDeletedFilter(
    supabase.from("parts_orders").select(`${listSelect}, confirmed_at`)
  )
    .order("created_at", { ascending: false })
    .limit(limit);

  data = withConfirmed.data;
  error = withConfirmed.error;

  if (error?.message?.includes("confirmed_at")) {
    const fallback = await notDeletedFilter(supabase.from("parts_orders").select(listSelect))
      .order("created_at", { ascending: false })
      .limit(limit);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error("[fetchAdminOrders]", error.message);
    return [];
  }

  const rows = (data ?? []) as Array<OrderRow & { parts_order_items?: OrderItemRow[] }>;
  const ids = rows.map((row) => row.id);
  const snapshotRates = await ratesByEntityId("parts_order", ids, rates, supabase);

  return rows.map((row) => {
    const orderRates = snapshotRates.get(row.id) ?? rates;
    const items = (row.parts_order_items ?? []).map((item) => mapItem(item, orderRates));
    return mapSummary(row, items, orderRates);
  });
}

export async function fetchAdminOrderDetail(
  supabase: SupabaseClient,
  id: string,
  options: { rates?: ExchangeRateMap } = {}
): Promise<AdminOrderDetail | null> {
  const { rates = getStaticFallbackRates() } = options;
  const baseSelect = `
    id, user_id, email, name, phone, status, total_usd, notes, created_at, updated_at,
    parts_order_items (
      id, item_type, part_id, vehicle_id, part_name, part_slug, sku, quantity, unit_price_usd, item_intent
    )
  `;

  let data: Record<string, unknown> | null = null;
  let error: { message: string } | null = null;

  const withConfirmed = await supabase
    .from("parts_orders")
    .select(`${baseSelect}, confirmed_at`)
    .eq("id", id)
    .maybeSingle();

  data = withConfirmed.data;
  error = withConfirmed.error;

  if (error?.message?.includes("confirmed_at")) {
    const fallback = await supabase
      .from("parts_orders")
      .select(baseSelect)
      .eq("id", id)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data) {
    if (error) console.error("[fetchAdminOrderDetail]", error.message);
    return null;
  }

  const snapshot = await loadFxSnapshot("parts_order", id, supabase);
  const orderRates = snapshot ? ratesMapFromSnapshot(snapshot) : rates;

  const rawItems = ((data as { parts_order_items?: OrderItemRow[] }).parts_order_items ?? []).map(
    (item) => mapItem(item, orderRates)
  );
  const items = await attachVehicleImages(supabase, rawItems);
  const appointment = await fetchOrderAppointment(supabase, id);

  return {
    ...mapSummary(data as OrderRow, items, orderRates),
    items,
    appointment,
    fxSnapshot: snapshot,
  };
}

