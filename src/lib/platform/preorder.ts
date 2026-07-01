import { formatPlatformPrice } from "@/lib/currency";
import { formatVehicleName } from "@/lib/format";
import { buildCustomVehicleTitle } from "@/lib/platform/custom-request";

export type PreorderVehicleInfo = {
  id?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  slug?: string;
  price?: number;
  image?: string;
  title?: string;
  status?: string;
};

export type PreorderCustomerInfo = {
  name: string;
  email: string;
  phone?: string;
  message?: string;
};

export type PreorderNotificationMetadata = {
  customer?: PreorderCustomerInfo;
  vehicle?: PreorderVehicleInfo;
  downPaymentUsd?: number;
  downPaymentFormatted?: string;
  paymentStatus?: PreorderPaymentStatus;
};

export type PreorderPaymentStatus =
  | "pending"
  | "down_payment_paid"
  | "completed"
  | "cancelled";

export type PreorderInquiryRow = {
  id: string;
  vehicle_id?: string | null;
  user_id?: string | null;
  customer_registration_id?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  message?: string | null;
  down_payment_usd?: number;
  payment_status?: PreorderPaymentStatus;
  status?: string;
  source?: string;
  follow_up_notes?: string | null;
  vehicle_slug?: string | null;
  vehicle_title?: string | null;
  vehicle_price_usd?: number | null;
  shipping_handling?: string | null;
  shipping_terms_accepted?: boolean;
  shipping_terms_accepted_at?: string | null;
  created_at?: string;
  is_custom_request?: boolean;
  requested_make?: string | null;
  requested_model?: string | null;
  requested_year?: string | null;
  requested_specs?: Record<string, unknown> | null;
  budget_min?: number | null;
  budget_max?: number | null;
  reference_code?: string | null;
  matched_vehicle_id?: string | null;
  vehicle?: PreorderVehicleInfo | PreorderVehicleInfo[] | null;
};

export function paymentStatusLabel(status: PreorderPaymentStatus | string): string {
  switch (status) {
    case "down_payment_paid":
      return "Down Payment Received";
    case "completed":
      return "Payment Complete";
    case "cancelled":
      return "Cancelled";
    default:
      return "Pending Payment";
  }
}

/** @deprecated Use formatPlatformPrice — kept for existing platform imports. */
export function formatUsd(amount: number) {
  return formatPlatformPrice(amount);
}

export function vehicleTitleFromRow(row: PreorderInquiryRow): string {
  if (row.is_custom_request) {
    return (
      row.vehicle_title ??
      buildCustomVehicleTitle(row.requested_make, row.requested_model, row.requested_year)
    );
  }
  if (row.vehicle_title) return row.vehicle_title;

  const joined = normalizeVehicle(row.vehicle);
  if (joined) {
    if (joined.title) return joined.title;
    if (joined.year && joined.make && joined.model) {
      return formatVehicleName({
        year: joined.year,
        make: joined.make,
        model: joined.model,
        trim: joined.trim,
      });
    }
  }

  if (row.vehicle_slug) return row.vehicle_slug;
  return "Unknown vehicle";
}

export function normalizeVehicle(
  vehicle?: PreorderVehicleInfo | PreorderVehicleInfo[] | null
): PreorderVehicleInfo | undefined {
  if (!vehicle) return undefined;
  return Array.isArray(vehicle) ? vehicle[0] : vehicle;
}

export function vehicleImageFromRow(row: PreorderInquiryRow): string | undefined {
  const joined = normalizeVehicle(row.vehicle);
  if (joined?.image) return joined.image;
  const images = (joined as { images?: string[] } | undefined)?.images;
  if (images?.length) return images[0];
  return undefined;
}

export function buildPreorderMetadata(row: PreorderInquiryRow): PreorderNotificationMetadata {
  const vehicle = normalizeVehicle(row.vehicle);
  const title = vehicleTitleFromRow(row);
  const downPaymentUsd = Number(row.down_payment_usd ?? 0);

  return {
    customer: {
      name: row.name,
      email: row.email,
      phone: row.phone ?? undefined,
      message: row.message ?? undefined,
    },
    vehicle: {
      id: row.vehicle_id ?? vehicle?.id,
      year: vehicle?.year,
      make: vehicle?.make,
      model: vehicle?.model,
      trim: vehicle?.trim,
      slug: row.vehicle_slug ?? vehicle?.slug,
      price: row.vehicle_price_usd ?? vehicle?.price,
      image: vehicleImageFromRow(row),
      title,
      status: vehicle?.status,
    },
    downPaymentUsd,
    downPaymentFormatted: formatUsd(downPaymentUsd),
    paymentStatus: row.payment_status ?? "pending",
  };
}

export function parsePreorderMetadata(
  metadata: unknown
): PreorderNotificationMetadata | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  return metadata as PreorderNotificationMetadata;
}
