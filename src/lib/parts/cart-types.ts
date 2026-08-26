import { VEHICLE_UUID_RE } from "@/lib/vehicles/identifier-map";

export type CartItemType = "part" | "vehicle";

export type CartVehicleIntent = "buy" | "pre_order";

export type CartPartSnapshot = {
  slug: string;
  name: string;
  sku?: string | null;
  priceUsd: number;
  image?: string | null;
  stockQuantity?: number;
};

export type CartVehicleSnapshot = {
  slug: string;
  name: string;
  priceUsd: number;
  image?: string | null;
  status?: string | null;
};

export type CartPartLine = {
  itemType: "part";
  partId: string;
  quantity: number;
  snapshot?: CartPartSnapshot;
};

export type CartVehicleLine = {
  itemType: "vehicle";
  vehicleId: string;
  quantity: number;
  intent?: CartVehicleIntent;
  snapshot?: CartVehicleSnapshot;
};

export type CartLineInput = CartPartLine | CartVehicleLine;

export type CartLineResolved = {
  partId: string;
  slug: string;
  name: string;
  sku: string | null;
  priceUsd: number;
  quantity: number;
  stockQuantity: number;
  image: string | null;
  /** True when showing cached snapshot — price may refresh in background. */
  fromSnapshot?: boolean;
};

export type CartVehicleCatalogState = {
  publiclyListed: boolean;
  listingPending: boolean;
  approvalStatus: string | null;
  source: "public" | "admin";
};

export type CartVehicleResolved = {
  vehicleId: string;
  slug: string;
  name: string;
  priceUsd: number;
  quantity: number;
  image: string | null;
  status: string | null;
  intent: CartVehicleIntent;
  /** True when showing cached snapshot — price may refresh in background. */
  fromSnapshot?: boolean;
  /** True after a successful public inventory lookup confirmed this line. */
  lookupConfirmed?: boolean;
  /** Set when lookup finished but the vehicle is not publicly listed. */
  unresolvedReason?: "not_found" | "listing_pending" | "not_public";
  /** How this line was resolved against the vehicles table. */
  catalog?: CartVehicleCatalogState;
};

export type PartsOrderItemSummary = {
  id: string;
  item_type: "part" | "vehicle";
  name: string;
  slug: string | null;
  sku: string | null;
  quantity: number;
  unit_price_usd: number;
  item_intent: "buy" | "pre_order" | null;
  vehicle_id?: string | null;
  image_url?: string | null;
};

export type PartsOrderSummary = {
  id: string;
  status: string;
  total_usd: number;
  created_at: string;
  item_count: number;
  items?: PartsOrderItemSummary[];
  /** Frozen USD-base rates from the document snapshot, when present. */
  fxRates?: Record<string, number>;
};

export type CustomerCartSummary = {
  item_count: number;
  part_count: number;
  vehicle_count: number;
  updated_at: string | null;
  items: CartLineInput[];
};

export function cartLineKey(line: CartLineInput): string {
  return line.itemType === "part"
    ? `part:${line.partId}`
    : `vehicle:${line.vehicleId}`;
}

export function isPartLine(line: CartLineInput): line is CartPartLine {
  return line.itemType === "part";
}

export function isVehicleLine(line: CartLineInput): line is CartVehicleLine {
  return line.itemType === "vehicle";
}

/** Slug for matching legacy slug cart keys to canonical UUID lines. */
export function vehicleLineSlug(line: Pick<CartVehicleLine, "vehicleId" | "snapshot">): string | null {
  if (line.snapshot?.slug) return line.snapshot.slug;
  if (!VEHICLE_UUID_RE.test(line.vehicleId)) return line.vehicleId;
  return null;
}

/** True when two vehicle lines refer to the same vehicle (UUID or legacy slug key). */
export function vehicleLinesMatch(
  a: Pick<CartVehicleLine, "vehicleId" | "snapshot">,
  b: Pick<CartVehicleLine, "vehicleId" | "snapshot">
): boolean {
  if (a.vehicleId === b.vehicleId) return true;

  const slugA = vehicleLineSlug(a);
  const slugB = vehicleLineSlug(b);
  if (slugA && slugB && slugA === slugB) return true;
  if (slugA && a.vehicleId === slugB) return true;
  if (slugB && b.vehicleId === slugA) return true;
  if (slugA && !VEHICLE_UUID_RE.test(b.vehicleId) && slugA === b.vehicleId) return true;
  if (slugB && !VEHICLE_UUID_RE.test(a.vehicleId) && slugB === a.vehicleId) return true;

  return false;
}

function mergeVehicleCartLine(
  existing: CartVehicleLine,
  incoming: CartVehicleLine
): CartVehicleLine {
  const preferred = VEHICLE_UUID_RE.test(existing.vehicleId)
    ? existing
    : VEHICLE_UUID_RE.test(incoming.vehicleId)
      ? incoming
      : existing;
  const other = preferred === existing ? incoming : existing;

  return {
    ...preferred,
    quantity: Math.max(preferred.quantity, other.quantity),
    snapshot: preferred.snapshot ?? other.snapshot,
    intent: preferred.intent ?? other.intent,
  };
}

/** Collapse duplicate lines — never sums qty for the same vehicle/part identity. */
export function deduplicateCartItems(items: CartLineInput[]): CartLineInput[] {
  const parts = new Map<string, CartPartLine>();
  const vehicles: CartVehicleLine[] = [];

  for (const item of items) {
    if (isPartLine(item)) {
      const existing = parts.get(item.partId);
      parts.set(
        item.partId,
        existing
          ? {
              ...existing,
              quantity: Math.max(existing.quantity, item.quantity),
              snapshot: existing.snapshot ?? item.snapshot,
            }
          : item
      );
      continue;
    }

    if (isVehicleLine(item)) {
      const index = vehicles.findIndex((line) => vehicleLinesMatch(line, item));
      if (index === -1) {
        vehicles.push(item);
      } else {
        vehicles[index] = mergeVehicleCartLine(vehicles[index], item);
      }
    }
  }

  return [...parts.values(), ...vehicles];
}

/** Resolve buy vs pre-order intent from cart line fields. */
export function resolveCartVehicleIntent(
  line: Pick<CartVehicleLine, "intent" | "snapshot">
): CartVehicleIntent {
  if (line.intent === "pre_order" || line.intent === "buy") return line.intent;
  return line.snapshot?.status === "pre_order" ? "pre_order" : "buy";
}

function normalizePartSnapshot(raw: unknown): CartPartSnapshot | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  if (typeof row.slug !== "string" || typeof row.name !== "string") return undefined;
  if (typeof row.priceUsd !== "number") return undefined;
  return {
    slug: row.slug,
    name: row.name,
    sku: typeof row.sku === "string" ? row.sku : null,
    priceUsd: row.priceUsd,
    image: typeof row.image === "string" ? row.image : null,
    stockQuantity:
      typeof row.stockQuantity === "number" ? row.stockQuantity : undefined,
  };
}

function normalizeVehicleSnapshot(raw: unknown): CartVehicleSnapshot | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  if (typeof row.slug !== "string" || typeof row.name !== "string") return undefined;
  if (typeof row.priceUsd !== "number") return undefined;
  return {
    slug: row.slug,
    name: row.name,
    priceUsd: row.priceUsd,
    image: typeof row.image === "string" ? row.image : null,
    status: typeof row.status === "string" ? row.status : null,
  };
}

export function partLineFromSnapshot(
  item: CartPartLine
): CartLineResolved | null {
  const snap = item.snapshot;
  if (!snap) return null;
  return {
    partId: item.partId,
    slug: snap.slug,
    name: snap.name,
    sku: snap.sku ?? null,
    priceUsd: snap.priceUsd,
    quantity: item.quantity,
    stockQuantity: snap.stockQuantity ?? 0,
    image: snap.image ?? null,
    fromSnapshot: true,
  };
}

export function vehicleLineFromSnapshot(
  item: CartVehicleLine
): CartVehicleResolved | null {
  const snap = item.snapshot;
  if (!snap) return null;
  return {
    vehicleId: item.vehicleId,
    slug: snap.slug,
    name: snap.name,
    priceUsd: snap.priceUsd,
    quantity: item.quantity,
    image: snap.image ?? null,
    status: snap.status ?? null,
    intent: item.intent ?? (snap.status === "pre_order" ? "pre_order" : "buy"),
    fromSnapshot: true,
  };
}

/** Normalize legacy `{ partId, quantity }` payloads from older clients. */
export function normalizeCartLine(raw: unknown): CartLineInput | null {
  if (!raw || typeof raw !== "object") return null;

  const row = raw as Record<string, unknown>;

  if (row.itemType === "vehicle") {
    if (typeof row.vehicleId !== "string" || typeof row.quantity !== "number") {
      return null;
    }
    if (row.quantity < 1) return null;
    const intent =
      row.intent === "pre_order" || row.intent === "buy" ? row.intent : undefined;
    const snapshot = normalizeVehicleSnapshot(row.snapshot);
    return {
      itemType: "vehicle",
      vehicleId: row.vehicleId,
      quantity: Math.floor(row.quantity),
      intent,
      ...(snapshot ? { snapshot } : {}),
    };
  }

  const partId =
    typeof row.partId === "string"
      ? row.partId
      : row.itemType === "part" && typeof row.itemId === "string"
        ? row.itemId
        : null;

  if (!partId || typeof row.quantity !== "number" || row.quantity < 1) {
    return null;
  }

  const snapshot = normalizePartSnapshot(row.snapshot);
  return {
    itemType: "part",
    partId,
    quantity: Math.floor(row.quantity),
    ...(snapshot ? { snapshot } : {}),
  };
}
