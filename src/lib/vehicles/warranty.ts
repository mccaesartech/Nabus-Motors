import type { Condition, Vehicle } from "@/lib/types";

const DEFAULT_WARRANTY_BY_CONDITION: Record<Condition, string> = {
  New:
    "Manufacturer warranty applies where eligible. Nabus Motors provides purchase documentation and warranty transfer assistance.",
  "Certified Pre-Owned":
    "Limited Nabus Motors assurance on key mechanical systems for 90 days or 3,000 miles after delivery. Contact us for full coverage terms.",
  Used:
    "Sold as-is unless otherwise noted in the listing. Extended warranty and service packages are available through Nabus Motors — ask your advisor.",
};

export function resolveWarrantyNotes(vehicle: Pick<Vehicle, "warrantyNotes" | "condition">): string {
  const custom = vehicle.warrantyNotes?.trim();
  if (custom) return custom;
  return DEFAULT_WARRANTY_BY_CONDITION[vehicle.condition];
}
