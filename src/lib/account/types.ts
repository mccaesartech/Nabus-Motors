export type CustomerAppointmentSummary = {
  id: string;
  status: string;
  preferred_date: string | null;
  preferred_time: string | null;
  branch: string | null;
  created_at: string;
  order_id: string | null;
  vehicle_names: string[];
};

export function orderReferenceId(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function isRecentOrder(createdAt: string, days = 7): boolean {
  const created = new Date(createdAt).getTime();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return created >= cutoff;
}

export function appointmentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pending confirmation",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "No show",
  };
  return labels[status] ?? status.replace(/_/g, " ");
}
