import type { Vehicle } from "@/lib/types";
import {
  inferVehicleOrigin,
  priceBandFor,
  snapshotFromVehicle,
  type AttributeScores,
  type VehiclePreferenceStore,
} from "@/lib/vehicle-preferences";

export interface ScoredVehicle {
  vehicle: Vehicle;
  score: number;
  matchedAttributes: string[];
}

export interface RecommendationResult {
  vehicles: Vehicle[];
  subtitle: string;
  hasPersonalization: boolean;
}

const ATTRIBUTE_WEIGHTS = {
  bodyType: 3,
  make: 2.5,
  fuelType: 2,
  priceBand: 2,
  origin: 1.5,
} as const;

function topKey(scores: Record<string, number>): { key: string; score: number } | null {
  let best: { key: string; score: number } | null = null;
  for (const [key, score] of Object.entries(scores)) {
    if (key === "Any" || score <= 0) continue;
    if (!best || score > best.score) best = { key, score };
  }
  return best;
}

function scoreAgainstProfile(
  vehicle: Vehicle,
  profile: AttributeScores
): { score: number; matched: string[] } {
  const snapshot = snapshotFromVehicle(vehicle);
  let score = 0;
  const matched: string[] = [];

  const checks: Array<{
    attr: keyof AttributeScores;
    vehicleValue: string;
    label: string;
  }> = [
    { attr: "bodyType", vehicleValue: snapshot.bodyType, label: snapshot.bodyType },
    { attr: "make", vehicleValue: snapshot.make, label: snapshot.make },
    { attr: "fuelType", vehicleValue: snapshot.fuelType, label: snapshot.fuelType },
    { attr: "priceBand", vehicleValue: snapshot.priceBand, label: formatPriceBand(snapshot.priceBand) },
    { attr: "origin", vehicleValue: snapshot.origin, label: formatOrigin(snapshot.origin) },
  ];

  for (const check of checks) {
    const prefScore = profile[check.attr][check.vehicleValue] ?? 0;
    if (prefScore > 0) {
      score += prefScore * ATTRIBUTE_WEIGHTS[check.attr];
      matched.push(check.label);
    }
  }

  if (vehicle.featured) score += 0.5;

  return { score, matched };
}

function formatPriceBand(band: string): string {
  switch (band) {
    case "under-20k":
      return "budget-friendly";
    case "20k-40k":
      return "mid-range";
    case "40k-70k":
      return "premium";
    case "over-70k":
      return "luxury";
    default:
      return band;
  }
}

function formatOrigin(origin: string): string {
  switch (origin) {
    case "china":
      return "Chinese imports";
    case "japan":
      return "Japanese imports";
    case "ghana":
      return "Ghana stock";
    default:
      return origin;
  }
}

export function buildRecommendationSubtitle(profile: AttributeScores): string {
  const topBody = topKey(profile.bodyType);
  const topMake = topKey(profile.make);
  const topFuel = topKey(profile.fuelType);
  const topOrigin = topKey(profile.origin);

  if (topBody && topBody.score >= 2) {
    return `Because you showed interest in ${topBody.key}s`;
  }
  if (topMake && topMake.score >= 2) {
    return `Because you explored ${topMake.key} vehicles`;
  }
  if (topFuel && topFuel.score >= 2) {
    return `Because you viewed ${topFuel.key} vehicles`;
  }
  if (topOrigin && topOrigin.score >= 2) {
    return `Based on your interest in ${formatOrigin(topOrigin.key)}`;
  }

  return "Picked for you based on your recent browsing";
}

function isRecommendable(vehicle: Vehicle): boolean {
  return vehicle.status !== "sold" && vehicle.price > 0;
}

function fallbackVehicles(vehicles: Vehicle[], limit: number): Vehicle[] {
  return [...vehicles]
    .filter(isRecommendable)
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, limit);
}

export function getRecommendations(
  vehicles: Vehicle[],
  store: VehiclePreferenceStore,
  options?: {
    limit?: number;
    excludeIds?: string[];
  }
): RecommendationResult {
  const limit = options?.limit ?? 6;
  const exclude = new Set(options?.excludeIds ?? []);
  const available = vehicles.filter(
    (vehicle) => isRecommendable(vehicle) && !exclude.has(vehicle.id) && !exclude.has(vehicle.slug)
  );

  const hasPersonalization = store.events.length >= 2;
  if (!hasPersonalization) {
    return {
      vehicles: fallbackVehicles(available, limit),
      subtitle: "Popular and newest arrivals",
      hasPersonalization: false,
    };
  }

  const scored: ScoredVehicle[] = available.map((vehicle) => {
    const { score, matched } = scoreAgainstProfile(vehicle, store.attributeScores);
    return { vehicle, score, matchedAttributes: matched };
  });

  const ranked = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const picks =
    ranked.length >= limit
      ? ranked.slice(0, limit).map((entry) => entry.vehicle)
      : [
          ...ranked.map((entry) => entry.vehicle),
          ...fallbackVehicles(
            available.filter(
              (vehicle) => !ranked.some((entry) => entry.vehicle.id === vehicle.id)
            ),
            limit - ranked.length
          ),
        ].slice(0, limit);

  return {
    vehicles: picks,
    subtitle: buildRecommendationSubtitle(store.attributeScores),
    hasPersonalization: true,
  };
}

/** Exported for tests and API documentation. */
export function explainVehicleMatch(vehicle: Vehicle, profile: AttributeScores): string[] {
  const { matched } = scoreAgainstProfile(vehicle, profile);
  return matched;
}

export function vehicleOriginLabel(vehicle: Vehicle): string {
  return formatOrigin(inferVehicleOrigin(vehicle));
}

export function vehiclePriceBandLabel(vehicle: Vehicle): string {
  return formatPriceBand(priceBandFor(vehicle.price));
}

/** Similar vehicles for detail page — same make/body/price band without requiring browse history. */
export function getRelatedVehicles(
  vehicles: Vehicle[],
  seed: Vehicle,
  limit = 4
): Vehicle[] {
  const seedSnapshot = snapshotFromVehicle(seed);
  const candidates = vehicles.filter(
    (vehicle) =>
      isRecommendable(vehicle) &&
      vehicle.id !== seed.id &&
      vehicle.slug !== seed.slug
  );

  const scored = candidates
    .map((vehicle) => {
      const snapshot = snapshotFromVehicle(vehicle);
      let score = 0;
      if (vehicle.make === seed.make) score += 4;
      if (vehicle.bodyType === seed.bodyType) score += 3;
      if (snapshot.priceBand === seedSnapshot.priceBand) score += 2;
      if (snapshot.origin === seedSnapshot.origin) score += 1.5;
      if (vehicle.featured) score += 0.5;
      return { vehicle, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length >= limit) {
    return scored.slice(0, limit).map((entry) => entry.vehicle);
  }

  const picked = new Set(scored.map((entry) => entry.vehicle.id));
  const fallback = fallbackVehicles(
    candidates.filter((vehicle) => !picked.has(vehicle.id)),
    limit - scored.length
  );

  return [...scored.map((entry) => entry.vehicle), ...fallback].slice(0, limit);
}
