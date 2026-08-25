export type AuditLogRow = {
  id: string;
  timestamp: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  browser: string | null;
  operating_system: string | null;
  request_id: string | null;
  success: boolean;
  error_message: string | null;
  metadata: Record<string, unknown>;
  country: string | null;
  region: string | null;
  city: string | null;
};

export function formatAuditLocation(row: {
  city?: string | null;
  region?: string | null;
  country?: string | null;
}): string {
  const parts = [row.city, row.region, row.country]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}
