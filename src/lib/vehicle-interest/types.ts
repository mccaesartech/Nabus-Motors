export const VEHICLE_INTEREST_ACTIVITY_TYPES = [
  "view",
  "video_watch",
  "save",
  "compare",
  "preorder_inquiry",
  "cart_add",
] as const;

export type VehicleInterestActivityType =
  (typeof VEHICLE_INTEREST_ACTIVITY_TYPES)[number];

export type PendingVehicleInterest = {
  vehicle_id: string;
  activity_type: VehicleInterestActivityType;
  email?: string | null;
  phone?: string | null;
  created_at: string;
};

export type VehicleInterestStats = {
  uniqueEmails: number;
  totalActivities: number;
  recentActivities: number;
};
