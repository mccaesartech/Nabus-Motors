export const ACCOUNT_STATUSES = [
  "active",
  "suspended",
  "pending_deletion",
  "archived",
  "deleted",
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const DELETION_REASONS = [
  "purchased_vehicle",
  "found_another_dealer",
  "privacy_concerns",
  "too_expensive",
  "technical_issues",
  "other",
] as const;

export type DeletionReason = (typeof DELETION_REASONS)[number];

export const DELETION_REASON_LABELS: Record<DeletionReason, string> = {
  purchased_vehicle: "Purchased vehicle",
  found_another_dealer: "Found another dealer",
  privacy_concerns: "Privacy concerns",
  too_expensive: "Too expensive",
  technical_issues: "Technical issues",
  other: "Other",
};

export function getAccountRetentionDaysClient(): number {
  const raw =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_ACCOUNT_DELETION_RETENTION_DAYS?.trim()
      : undefined;
  const parsed = raw ? Number.parseInt(raw, 10) : 30;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}
