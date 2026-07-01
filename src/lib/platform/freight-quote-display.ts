import { formatCargoDisplay } from "@/lib/freight/cargo-options";
import { FREIGHT_QUOTE_STATUS_LABELS } from "@/lib/platform/shipment";

export const FREIGHT_SERVICE_LABELS: Record<string, string> = {
  vehicle_shipping: "Vehicle shipping",
  container_shipping: "Container shipping",
  documentation: "Documentation only",
  clearing: "Clearing & delivery",
  other: "Other / not sure",
};

export function freightServiceLabel(serviceType: string | null | undefined): string {
  if (!serviceType) return "—";
  return FREIGHT_SERVICE_LABELS[serviceType] ?? serviceType.replace(/_/g, " ");
}

export function whatsAppOptInLabel(value: boolean | null | undefined): string {
  if (value === true) return "Yes — WhatsApp updates enabled";
  if (value === false) return "No — email/phone only";
  return "Not specified";
}

export type FreightQuoteRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  whatsapp_opt_in?: boolean | null;
  service_type: string;
  origin_country: string | null;
  destination: string | null;
  cargo_description: string | null;
  cargo_size: string | null;
  estimated_value_usd?: number | null;
  message: string | null;
  status: string;
  source?: string | null;
  user_id: string | null;
  customer_registration_id?: string | null;
  reference_code: string | null;
  converted_shipment_id: string | null;
  created_at: string;
  updated_at?: string | null;
};

export function formatFreightQuoteCargo(quote: Pick<FreightQuoteRow, "cargo_description" | "cargo_size">) {
  return formatCargoDisplay(quote.cargo_description, quote.cargo_size);
}

export function freightQuoteStatusLabel(status: string) {
  return FREIGHT_QUOTE_STATUS_LABELS[status as keyof typeof FREIGHT_QUOTE_STATUS_LABELS] ?? status;
}
