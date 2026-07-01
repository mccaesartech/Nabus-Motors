export const SALE_STATUSES = ["draft", "sent", "accepted", "completed", "cancelled"] as const;

export type SaleStatus = (typeof SALE_STATUSES)[number];

export type SaleRow = {
  id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  preorder_inquiry_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  sale_price: number;
  status: SaleStatus | string;
  valid_until: string | null;
  sale_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vehicle?: {
    id: string;
    year: number;
    make: string;
    model: string;
    trim?: string | null;
    price: number;
    status: string;
  } | null;
};

export function saleStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Sent";
    case "accepted":
      return "Accepted";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export function exportSalesCsv(rows: SaleRow[]) {
  const headers = [
    "id",
    "customer_name",
    "customer_email",
    "vehicle",
    "sale_price",
    "status",
    "valid_until",
    "sale_date",
    "created_at",
  ];

  const escape = (v: unknown) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  if (!rows.length) {
    return `${headers.join(",")}\n`;
  }

  const lines = [
    headers.join(","),
    ...rows.map((r) => {
      const vehicle = r.vehicle
        ? `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}`
        : "";
      return [
        r.id,
        r.customer_name ?? "",
        r.customer_email ?? "",
        vehicle,
        r.sale_price,
        r.status,
        r.valid_until ?? "",
        r.sale_date?.slice(0, 10) ?? "",
        r.created_at,
      ]
        .map(escape)
        .join(",");
    }),
  ];
  return lines.join("\n");
}
