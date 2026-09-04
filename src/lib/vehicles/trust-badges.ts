export const TRUST_BADGE_KEYS = [
  "verified_by_true_goshen",
  "professionally_inspected",
  "documentation_verified",
  "mileage_verified",
  "import_status_verified",
  "genuine_listing",
] as const;

export type TrustBadgeKey = (typeof TRUST_BADGE_KEYS)[number];

export type VehicleTrustBadges = Record<TrustBadgeKey, boolean>;

export const TRUST_BADGE_LABELS: Record<TrustBadgeKey, string> = {
  verified_by_true_goshen: "Verified by Nabus Motors",
  professionally_inspected: "Professionally Inspected",
  documentation_verified: "Documentation Verified",
  mileage_verified: "Mileage Verified",
  import_status_verified: "Import Status Verified",
  genuine_listing: "Genuine Listing",
};

export const DEFAULT_TRUST_BADGES: VehicleTrustBadges = {
  verified_by_true_goshen: true,
  professionally_inspected: false,
  documentation_verified: false,
  mileage_verified: false,
  import_status_verified: false,
  genuine_listing: true,
};

export function parseTrustBadges(raw: unknown): VehicleTrustBadges {
  const badges = { ...DEFAULT_TRUST_BADGES };
  if (!raw || typeof raw !== "object") return badges;

  for (const key of TRUST_BADGE_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "boolean") badges[key] = value;
  }

  return badges;
}

export function activeTrustBadges(badges: VehicleTrustBadges): TrustBadgeKey[] {
  return TRUST_BADGE_KEYS.filter((key) => badges[key]);
}

export function trustBadgeSummary(badges: VehicleTrustBadges): string {
  const active = activeTrustBadges(badges);
  if (active.length === 0) return "";
  if (active.length === 1) return TRUST_BADGE_LABELS[active[0]];
  return `${active.length} trust indicators`;
}
