/** Lightweight vehicle preference tracking for explainable recommendations. */

import { CHINESE_MAKES } from "@/lib/vehicles/chinese-makes";
import type { Vehicle, VehicleFilters } from "@/lib/types";

export const VEHICLE_PREFERENCES_KEY = "true-goshen-vehicle-preferences";
export const VEHICLE_PREFERENCES_EVENT = "true-goshen-vehicle-preferences-change";

export type EngagementType = "view" | "click" | "save" | "preorder" | "cart_add";

export type VehicleOrigin = "china" | "japan" | "ghana" | "other";

export type PriceBand = "under-20k" | "20k-40k" | "40k-70k" | "over-70k";

export const ENGAGEMENT_WEIGHTS: Record<EngagementType, number> = {
  view: 1,
  click: 2,
  save: 5,
  cart_add: 8,
  preorder: 10,
};

const SEARCH_WEIGHT = 0.5;
const MAX_EVENTS = 50;
const RECENCY_HALF_LIFE_DAYS = 14;

export const JAPANESE_MAKES = [
  "Toyota",
  "Honda",
  "Nissan",
  "Mazda",
  "Subaru",
  "Mitsubishi",
  "Lexus",
  "Suzuki",
  "Isuzu",
  "Infiniti",
  "Acura",
  "Daihatsu",
] as const;

export interface VehicleEngagementSnapshot {
  vehicleId: string;
  make: string;
  model: string;
  bodyType: string;
  fuelType: string;
  price: number;
  condition: string;
  origin: VehicleOrigin;
  priceBand: PriceBand;
}

export interface PreferenceEvent {
  type: EngagementType | "search";
  at: string;
  snapshot: VehicleEngagementSnapshot;
}

export interface AttributeScores {
  make: Record<string, number>;
  bodyType: Record<string, number>;
  fuelType: Record<string, number>;
  priceBand: Record<string, number>;
  origin: Record<string, number>;
}

export interface VehiclePreferenceStore {
  version: 1;
  events: PreferenceEvent[];
  attributeScores: AttributeScores;
  updatedAt: string;
}

const EMPTY_SCORES: AttributeScores = {
  make: {},
  bodyType: {},
  fuelType: {},
  priceBand: {},
  origin: {},
};

const EMPTY_STORE: VehiclePreferenceStore = {
  version: 1,
  events: [],
  attributeScores: { ...EMPTY_SCORES },
  updatedAt: new Date(0).toISOString(),
};

function notifyPreferencesChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(VEHICLE_PREFERENCES_EVENT));
}

export function priceBandFor(price: number): PriceBand {
  if (price < 20_000) return "under-20k";
  if (price < 40_000) return "20k-40k";
  if (price < 70_000) return "40k-70k";
  return "over-70k";
}

export function inferVehicleOrigin(vehicle: Pick<Vehicle, "make" | "location" | "condition">): VehicleOrigin {
  if (CHINESE_MAKES.includes(vehicle.make as (typeof CHINESE_MAKES)[number])) {
    return "china";
  }
  if (JAPANESE_MAKES.includes(vehicle.make as (typeof JAPANESE_MAKES)[number])) {
    return "japan";
  }
  if (
    vehicle.condition === "Used" ||
    vehicle.location.toLowerCase().includes("ghana")
  ) {
    return "ghana";
  }
  return "other";
}

export function snapshotFromVehicle(vehicle: Vehicle): VehicleEngagementSnapshot {
  return {
    vehicleId: vehicle.id,
    make: vehicle.make,
    model: vehicle.model,
    bodyType: vehicle.bodyType,
    fuelType: vehicle.fuelType,
    price: vehicle.price,
    condition: vehicle.condition,
    origin: inferVehicleOrigin(vehicle),
    priceBand: priceBandFor(vehicle.price),
  };
}

function recencyMultiplier(at: string): number {
  const ageMs = Date.now() - new Date(at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
}

function addScore(
  scores: Record<string, number>,
  key: string,
  delta: number
): Record<string, number> {
  if (!key) return scores;
  return { ...scores, [key]: (scores[key] ?? 0) + delta };
}

function applySnapshotToScores(
  scores: AttributeScores,
  snapshot: VehicleEngagementSnapshot,
  weight: number
): AttributeScores {
  return {
    make: addScore(scores.make, snapshot.make, weight),
    bodyType: addScore(scores.bodyType, snapshot.bodyType, weight),
    fuelType: addScore(scores.fuelType, snapshot.fuelType, weight),
    priceBand: addScore(scores.priceBand, snapshot.priceBand, weight),
    origin: addScore(scores.origin, snapshot.origin, weight),
  };
}

export function rebuildAttributeScores(events: PreferenceEvent[]): AttributeScores {
  let scores: AttributeScores = {
    make: {},
    bodyType: {},
    fuelType: {},
    priceBand: {},
    origin: {},
  };

  for (const event of events) {
    const baseWeight =
      event.type === "search"
        ? SEARCH_WEIGHT
        : ENGAGEMENT_WEIGHTS[event.type as EngagementType] ?? 1;
    const weight = baseWeight * recencyMultiplier(event.at);
    scores = applySnapshotToScores(scores, event.snapshot, weight);
  }

  return scores;
}

function normalizeStore(parsed: unknown): VehiclePreferenceStore {
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("events" in parsed) ||
    !Array.isArray((parsed as VehiclePreferenceStore).events)
  ) {
    return { ...EMPTY_STORE, attributeScores: { ...EMPTY_SCORES } };
  }

  const data = parsed as VehiclePreferenceStore;
  const events = data.events
    .filter(
      (event): event is PreferenceEvent =>
        Boolean(event?.snapshot?.vehicleId && event?.at && event?.type)
    )
    .slice(0, MAX_EVENTS);

  return {
    version: 1,
    events,
    attributeScores: rebuildAttributeScores(events),
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
}

export function readVehiclePreferences(): VehiclePreferenceStore {
  if (typeof window === "undefined") {
    return { ...EMPTY_STORE, attributeScores: { ...EMPTY_SCORES } };
  }
  try {
    const raw = localStorage.getItem(VEHICLE_PREFERENCES_KEY);
    if (!raw) {
      return { ...EMPTY_STORE, attributeScores: { ...EMPTY_SCORES } };
    }
    return normalizeStore(JSON.parse(raw));
  } catch {
    return { ...EMPTY_STORE, attributeScores: { ...EMPTY_SCORES } };
  }
}

function writeVehiclePreferences(store: VehiclePreferenceStore) {
  try {
    localStorage.setItem(VEHICLE_PREFERENCES_KEY, JSON.stringify(store));
  } catch {
    // ignore quota / private-mode errors
  }
}

export function hasMeaningfulPreferences(store: VehiclePreferenceStore): boolean {
  return store.events.length >= 2;
}

export function recordVehicleEngagement(
  type: EngagementType,
  vehicle: Vehicle
): VehiclePreferenceStore {
  if (typeof window === "undefined") {
    return { ...EMPTY_STORE, attributeScores: { ...EMPTY_SCORES } };
  }

  const current = readVehiclePreferences();
  const event: PreferenceEvent = {
    type,
    at: new Date().toISOString(),
    snapshot: snapshotFromVehicle(vehicle),
  };

  const events = [event, ...current.events].slice(0, MAX_EVENTS);
  const next: VehiclePreferenceStore = {
    version: 1,
    events,
    attributeScores: rebuildAttributeScores(events),
    updatedAt: new Date().toISOString(),
  };

  writeVehiclePreferences(next);
  notifyPreferencesChange();

  const interestType =
    type === "view"
      ? "view"
      : type === "save"
        ? "save"
        : type === "preorder"
          ? "preorder_inquiry"
          : type === "cart_add"
            ? "cart_add"
            : null;
  if (interestType) {
    void import("@/lib/vehicle-interest/client").then(({ trackVehicleInterest }) => {
      trackVehicleInterest(interestType, vehicle);
    });
  }

  return next;
}

function snapshotFromSearchFilters(filters: VehicleFilters): VehicleEngagementSnapshot | null {
  if (
    !filters.make &&
    !filters.bodyType &&
    !filters.fuelType &&
    !filters.priceMin &&
    !filters.priceMax &&
    !filters.chineseBrands
  ) {
    return null;
  }

  const price =
    filters.priceMax ??
    filters.priceMin ??
    (filters.priceMin && filters.priceMax
      ? Math.round((filters.priceMin + filters.priceMax) / 2)
      : 30_000);

  let origin: VehicleOrigin = "other";
  if (filters.chineseBrands) origin = "china";

  return {
    vehicleId: `search-${Date.now()}`,
    make: filters.make ?? "Any",
    model: filters.model ?? "Any",
    bodyType: filters.bodyType ?? "Any",
    fuelType: filters.fuelType ?? "Any",
    price,
    condition: filters.condition ?? "Any",
    origin,
    priceBand: priceBandFor(price),
  };
}

export function recordSearchPreferences(filters: VehicleFilters) {
  const snapshot = snapshotFromSearchFilters(filters);
  if (!snapshot || typeof window === "undefined") return;

  const current = readVehiclePreferences();
  const event: PreferenceEvent = {
    type: "search",
    at: new Date().toISOString(),
    snapshot,
  };

  const events = [event, ...current.events].slice(0, MAX_EVENTS);
  const next: VehiclePreferenceStore = {
    version: 1,
    events,
    attributeScores: rebuildAttributeScores(events),
    updatedAt: new Date().toISOString(),
  };

  writeVehiclePreferences(next);
  notifyPreferencesChange();
}

export function mergePreferenceStores(
  local: VehiclePreferenceStore,
  remote: VehiclePreferenceStore | null | undefined
): VehiclePreferenceStore {
  if (!remote?.events?.length) return local;
  if (!local.events.length) return normalizeStore(remote);

  const mergedEvents = [...local.events, ...remote.events]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, MAX_EVENTS);

  return {
    version: 1,
    events: mergedEvents,
    attributeScores: rebuildAttributeScores(mergedEvents),
    updatedAt: new Date().toISOString(),
  };
}

export function subscribeVehiclePreferences(callback: () => void) {
  window.addEventListener(VEHICLE_PREFERENCES_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(VEHICLE_PREFERENCES_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export async function syncVehiclePreferencesToProfile(
  getAccessToken: () => Promise<string | null>
): Promise<void> {
  const token = await getAccessToken();
  if (!token) return;

  const store = readVehiclePreferences();
  if (!store.events.length) return;

  try {
    await fetch("/api/customer/sync-account", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vehiclePreferences: store }),
    });
  } catch {
    // Non-blocking
  }
}

export async function loadVehiclePreferencesFromProfile(
  getAccessToken: () => Promise<string | null>
): Promise<void> {
  const token = await getAccessToken();
  if (!token) return;

  try {
    const res = await fetch("/api/customer/profile-preferences", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;

    const json = (await res.json()) as {
      vehiclePreferences?: VehiclePreferenceStore | null;
    };
    if (!json.vehiclePreferences?.events?.length) return;

    const local = readVehiclePreferences();
    const merged = mergePreferenceStores(local, json.vehiclePreferences);
    writeVehiclePreferences(merged);
    notifyPreferencesChange();
  } catch {
    // Non-blocking
  }
}
