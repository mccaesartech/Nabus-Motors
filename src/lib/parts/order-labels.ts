export function orderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    shipped: "Shipped",
    fulfilled: "Fulfilled",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status.replace(/_/g, " ");
}
