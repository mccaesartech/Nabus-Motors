import type { SupabaseClient } from "@supabase/supabase-js";
import { platformPath } from "@/lib/platform/paths";
import { getSiteSettings } from "@/lib/platform/site-settings-server";
import { notifyStaffNewOrder } from "@/lib/platform/staff-order-notify";

type FreightQuoteRow = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  service_type: string;
  origin_country?: string | null;
  reference_code?: string | null;
  cargo_description?: string | null;
};

function freightQuoteMessage(row: FreightQuoteRow): string {
  const service = row.service_type.replace(/_/g, " ");
  const origin = row.origin_country?.trim();
  const ref = row.reference_code?.trim();
  const cargo = row.cargo_description?.trim();
  const parts = [
    origin ? `${row.name} requested ${service} from ${origin}` : `${row.name} requested ${service}`,
    ref ? `ref ${ref}` : null,
    cargo ? cargo.slice(0, 80) : null,
    "Please attend to this quote request promptly.",
  ].filter(Boolean);
  return parts.join(" · ");
}

function freightQuoteTitle(row: FreightQuoteRow): string {
  const service = row.service_type.replace(/_/g, " ");
  return `New freight quote — ${service}`;
}

function freightQuoteLink(id: string): string {
  return `${platformPath("freight/quotes")}?id=${encodeURIComponent(id)}`;
}

/** In-app + email/SMS for owner and freight-enabled staff after a quote submission. */
export async function notifyFreightQuoteRequest(
  supabase: SupabaseClient,
  row: FreightQuoteRow
): Promise<void> {
  const settings = await getSiteSettings();
  const outboundEnabled =
    settings.notifyEmailEnabled && settings.notifyFreightQuotesEnabled;

  await notifyStaffNewOrder(supabase, {
    notificationType: "freight_quote",
    title: freightQuoteTitle(row),
    message: freightQuoteMessage(row),
    link: freightQuoteLink(row.id),
    sourceTable: "freight_quote_requests",
    sourceId: row.id,
    permission: "freight",
    outboundEnabled,
    outboundEmail:
      settings.freight_quote_notification_email?.trim() ||
      settings.notification_email?.trim() ||
      settings.email?.trim() ||
      null,
    customerName: row.name,
    customerEmail: row.email?.trim() || "",
    customerPhone: row.phone?.trim() || null,
    metadata: {
      service_type: row.service_type,
      origin_country: row.origin_country ?? null,
      reference_code: row.reference_code ?? null,
    },
  });
}

export function isMissingTableError(message: string, table: string): boolean {
  const lower = message.toLowerCase();
  const tableLower = table.toLowerCase();
  return (
    lower.includes(tableLower) &&
    (lower.includes("does not exist") ||
      lower.includes("schema cache") ||
      lower.includes("could not find the table"))
  );
}
