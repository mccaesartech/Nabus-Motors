import type { SupabaseClient } from "@supabase/supabase-js";

type FreightQuoteRow = {
  id: string;
  name: string;
  service_type: string;
  origin_country?: string | null;
};

function freightQuoteMessage(row: FreightQuoteRow): string {
  const service = row.service_type.replace(/_/g, " ");
  const origin = row.origin_country?.trim();
  return origin ? `${row.name} requested ${service} from ${origin}` : `${row.name} requested ${service}`;
}

/** App-level fallback when DB trigger is not yet applied. Safe to call after every insert. */
export async function notifyFreightQuoteRequest(
  supabase: SupabaseClient,
  row: FreightQuoteRow
): Promise<void> {
  const { error } = await supabase.from("admin_notifications").insert({
    type: "freight_quote",
    title: "New freight quote request",
    message: freightQuoteMessage(row),
    link: "/platform/freight/quotes",
    source_table: "freight_quote_requests",
    source_id: row.id,
  });

  if (error && !/duplicate|unique/i.test(error.message)) {
    console.error("[freight-quote] admin notification insert failed:", error.message);
  }
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
