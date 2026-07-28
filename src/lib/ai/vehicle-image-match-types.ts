export type VehicleImageMatchStatus =
  | "match"
  | "mismatch"
  | "no_vehicle"
  | "uncertain";

export type VehicleImageMatchIssue = {
  url: string;
  status: VehicleImageMatchStatus;
  reason: string;
};

export type VehicleImageMatchContext = {
  make?: string;
  model?: string;
  year?: number | string;
  color?: string;
  body_type?: string;
};

export type VehicleImageMatchResult = {
  ok: boolean;
  configured: boolean;
  blocked: boolean;
  overallMatch: boolean;
  manualReviewRequired: boolean;
  summary: string;
  issues: VehicleImageMatchIssue[];
};
