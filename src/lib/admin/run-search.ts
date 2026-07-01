import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildOrIlike,
  groupSearchResults,
  ilikePattern,
  matchesSearchQuery,
  SEARCH_FULL_LIMITS,
  SEARCH_LIMITS,
  type AdminSearchGroup,
  type AdminSearchResult,
} from "@/lib/admin/search";
import { platformPath } from "@/lib/platform/paths";
import { ROUTES } from "@/lib/routes";
import { vehicleTitleFromRow } from "@/lib/platform/preorder";
import { leadTypeLabel } from "@/lib/platform/types";

function customerName(row: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): string {
  const full = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  return full || String(row.email ?? "Customer");
}

type SearchOptions = {
  full?: boolean;
  canEditInventory?: boolean;
};

function vehicleSearchHref(
  row: { id: string; slug?: string | null },
  canEditInventory: boolean
): string {
  if (canEditInventory) {
    return platformPath(`inventory/${row.id}/edit`);
  }
  if (row.slug) {
    return ROUTES.auto.inventoryDetail(row.slug);
  }
  return platformPath("inventory");
}

export async function runAdminSearch(
  supabase: SupabaseClient,
  q: string,
  options: SearchOptions = {}
): Promise<{ results: AdminSearchResult[]; groups: AdminSearchGroup[]; hadError: boolean }> {
  const limits = options.full ? SEARCH_FULL_LIMITS : SEARCH_LIMITS;
  const pattern = ilikePattern(q);
  const yearQuery = /^\d{4}$/.test(q.trim()) ? Number(q.trim()) : null;

  const results: AdminSearchResult[] = [];

  const vehicleOr = buildOrIlike(
    [
      "make",
      "model",
      "trim",
      "slug",
      "vin",
      "body_type",
      "location",
      "description",
      "status",
    ],
    pattern
  );
  const vehicleQuery = supabase
    .from("vehicles")
    .select(
      "id, year, make, model, trim, slug, vin, status, body_type, location, description"
    )
    .or(yearQuery !== null ? `${vehicleOr},year.eq.${yearQuery}` : vehicleOr)
    .order("created_at", { ascending: false })
    .limit(limits.vehicle);

  const customerOr = buildOrIlike(
    ["first_name", "last_name", "email", "phone"],
    pattern
  );
  const customerQuery = supabase
    .from("customers")
    .select("id, first_name, last_name, email, phone")
    .or(customerOr)
    .order("created_at", { ascending: false })
    .limit(limits.customer);

  const preorderOr = buildOrIlike(
    ["name", "email", "phone", "vehicle_title", "message", "vehicle_slug"],
    pattern
  );
  const preorderQuery = supabase
    .from("preorder_inquiries")
    .select("id, name, email, phone, vehicle_title, message, vehicle_slug")
    .or(preorderOr)
    .order("created_at", { ascending: false })
    .limit(Math.ceil(limits.lead / 2));

  const contactOr = buildOrIlike(["name", "email", "phone", "subject", "message"], pattern);
  const contactQuery = supabase
    .from("contact_inquiries")
    .select("id, name, email, subject, message")
    .or(contactOr)
    .order("created_at", { ascending: false })
    .limit(Math.ceil(limits.lead / 3));

  const vehicleLeadOr = buildOrIlike(
    ["name", "email", "vehicle_name", "vehicle_slug"],
    pattern
  );
  const vehicleLeadQuery = supabase
    .from("vehicle_inquiries")
    .select("id, name, email, vehicle_name, vehicle_slug")
    .or(vehicleLeadOr)
    .order("created_at", { ascending: false })
    .limit(Math.ceil(limits.lead / 3));

  const financeOr = buildOrIlike(
    ["first_name", "last_name", "email", "phone", "vehicle_of_interest", "notes"],
    pattern
  );
  const financeQuery = supabase
    .from("finance_applications")
    .select("id, first_name, last_name, email, phone, vehicle_of_interest")
    .or(financeOr)
    .order("created_at", { ascending: false })
    .limit(Math.ceil(limits.lead / 4));

  const appraisalOr = buildOrIlike(
    ["seller_name", "seller_phone", "make", "model", "notes"],
    pattern
  );
  const appraisalQuery = supabase
    .from("appraisal_requests")
    .select("id, seller_name, seller_phone, make, model, year")
    .or(
      yearQuery !== null
        ? `${appraisalOr},year.eq.${yearQuery}`
        : appraisalOr
    )
    .order("created_at", { ascending: false })
    .limit(Math.ceil(limits.lead / 4));

  const saleOr = buildOrIlike(
    ["customer_name", "customer_email", "status", "notes"],
    pattern
  );
  const saleQuery = supabase
    .from("sales")
    .select(
      "id, customer_name, customer_email, status, vehicle:vehicles(year, make, model)"
    )
    .or(saleOr)
    .order("created_at", { ascending: false })
    .limit(limits.sale);

  const messageOr = buildOrIlike(
    ["customer_name", "customer_email", "subject", "registration_id", "category"],
    pattern
  );
  const messageQuery = supabase
    .from("customer_conversations")
    .select("id, customer_name, customer_email, subject, category, status, registration_id")
    .or(messageOr)
    .order("created_at", { ascending: false })
    .limit(limits.message);

  const responses = await Promise.all([
    vehicleQuery,
    customerQuery,
    preorderQuery,
    contactQuery,
    vehicleLeadQuery,
    financeQuery,
    appraisalQuery,
    saleQuery,
    messageQuery,
  ]);

  const hadError = responses.some((res) => Boolean(res.error));
  const [
    vehiclesRes,
    customersRes,
    preorderRes,
    contactRes,
    vehicleLeadRes,
    financeRes,
    appraisalRes,
    salesRes,
    messagesRes,
  ] = responses;

  for (const row of vehiclesRes.data ?? []) {
    const title = `${row.year} ${row.make} ${row.model}${row.trim ? ` ${row.trim}` : ""}`;
    results.push({
      id: `vehicle-${row.id}`,
      type: "vehicle",
      title,
      subtitle: [row.status, row.vin, row.location].filter(Boolean).join(" · "),
      badge: "Vehicle",
      href: vehicleSearchHref(row, options.canEditInventory ?? true),
    });
  }

  for (const row of customersRes.data ?? []) {
    results.push({
      id: `customer-${row.id}`,
      type: "customer",
      title: customerName(row),
      subtitle: [row.email, row.phone].filter(Boolean).join(" · "),
      badge: "Customer",
      href: platformPath(`customers/${row.id}`),
    });
  }

  const leadResults: AdminSearchResult[] = [];

  for (const row of preorderRes.data ?? []) {
    const vehicleLabel =
      row.vehicle_title ??
      (row.vehicle_slug ? String(row.vehicle_slug).replace(/-/g, " ") : "");
    leadResults.push({
      id: `lead-preorder-${row.id}`,
      type: "lead",
      title: String(row.name ?? "Pre-order lead"),
      subtitle: [row.email, row.phone, vehicleLabel].filter(Boolean).join(" · "),
      badge: leadTypeLabel("preorder"),
      href: platformPath(`leads/preorder/${row.id}`),
    });
  }

  for (const row of contactRes.data ?? []) {
    leadResults.push({
      id: `lead-contact-${row.id}`,
      type: "lead",
      title: String(row.name ?? "Contact lead"),
      subtitle: [row.email, row.subject].filter(Boolean).join(" · "),
      badge: leadTypeLabel("contact"),
      href: `${platformPath("leads")}?tab=contact&q=${encodeURIComponent(row.email ?? q)}`,
    });
  }

  for (const row of vehicleLeadRes.data ?? []) {
    leadResults.push({
      id: `lead-vehicle-${row.id}`,
      type: "lead",
      title: String(row.name ?? "Vehicle inquiry"),
      subtitle: [row.email, row.vehicle_name ?? row.vehicle_slug]
        .filter(Boolean)
        .join(" · "),
      badge: leadTypeLabel("vehicle"),
      href: `${platformPath("leads")}?tab=vehicle&q=${encodeURIComponent(row.email ?? q)}`,
    });
  }

  for (const row of financeRes.data ?? []) {
    const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Finance lead";
    leadResults.push({
      id: `lead-finance-${row.id}`,
      type: "lead",
      title: name,
      subtitle: [row.email, row.vehicle_of_interest].filter(Boolean).join(" · "),
      badge: leadTypeLabel("finance"),
      href: `${platformPath("leads")}?tab=finance&q=${encodeURIComponent(row.email ?? q)}`,
    });
  }

  for (const row of appraisalRes.data ?? []) {
    const vehicle = `${row.year ?? ""} ${row.make ?? ""} ${row.model ?? ""}`.trim();
    leadResults.push({
      id: `lead-appraisal-${row.id}`,
      type: "lead",
      title: String(row.seller_name ?? "Trade-in request"),
      subtitle: [row.seller_phone, vehicle].filter(Boolean).join(" · "),
      badge: leadTypeLabel("appraisal"),
      href: `${platformPath("leads")}?tab=appraisal&q=${encodeURIComponent(row.seller_name ?? q)}`,
    });
  }

  results.push(...leadResults.slice(0, limits.lead));

  for (const row of salesRes.data ?? []) {
    const vehicle = row.vehicle as
      | { year?: number; make?: string; model?: string }
      | null
      | undefined;
    const vehicleLabel = vehicle
      ? `${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim()
      : "";

    results.push({
      id: `sale-${row.id}`,
      type: "sale",
      title: row.customer_name ?? row.customer_email ?? "Sale",
      subtitle: [vehicleLabel, row.status].filter(Boolean).join(" · "),
      badge: "Sale",
      href: `${platformPath("sales")}?q=${encodeURIComponent(row.customer_name ?? row.customer_email ?? q)}`,
    });
  }

  for (const row of messagesRes.data ?? []) {
    results.push({
      id: `message-${row.id}`,
      type: "message",
      title: row.subject || `Message from ${row.customer_name}`,
      subtitle: [row.customer_name, row.customer_email, row.category]
        .filter(Boolean)
        .join(" · "),
      badge: "Message",
      href: `${platformPath("messages")}?conversation=${encodeURIComponent(String(row.id))}`,
    });
  }

  const groups = groupSearchResults(results);

  return { results, groups, hadError };
}

/** Fallback when ilike OR filters fail (e.g. missing columns). */
export async function runAdminSearchFallback(
  supabase: SupabaseClient,
  q: string,
  options: SearchOptions = {}
): Promise<{ results: AdminSearchResult[]; groups: AdminSearchGroup[] }> {
  const limits = options.full ? SEARCH_FULL_LIMITS : SEARCH_LIMITS;
  const results: AdminSearchResult[] = [];

  const [vehiclesRes, customersRes, preorderRes, contactRes, vehicleLeadRes, financeRes, appraisalRes, salesRes, messagesRes] =
    await Promise.all([
      supabase
        .from("vehicles")
        .select("id, year, make, model, trim, slug, vin, status, body_type, location, description")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("customers")
        .select("id, first_name, last_name, email, phone")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("preorder_inquiries")
        .select("id, name, email, phone, vehicle_title, message, vehicle_slug")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("contact_inquiries")
        .select("id, name, email, subject, message")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("vehicle_inquiries")
        .select("id, name, email, vehicle_name, vehicle_slug")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("finance_applications")
        .select("id, first_name, last_name, email, phone, vehicle_of_interest")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("appraisal_requests")
        .select("id, seller_name, seller_phone, make, model, year")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("sales")
        .select("id, customer_name, customer_email, status, vehicle:vehicles(year, make, model)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("customer_conversations")
        .select("id, customer_name, customer_email, subject, category, status, registration_id")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  for (const row of vehiclesRes.data ?? []) {
    const haystack = `${row.year} ${row.make} ${row.model} ${row.trim ?? ""} ${row.slug ?? ""} ${row.vin ?? ""} ${row.body_type ?? ""} ${row.location ?? ""} ${row.description ?? ""} ${row.status ?? ""}`;
    if (!matchesSearchQuery(haystack, q)) continue;
    results.push({
      id: `vehicle-${row.id}`,
      type: "vehicle",
      title: `${row.year} ${row.make} ${row.model}`,
      subtitle: [row.status, row.vin].filter(Boolean).join(" · "),
      badge: "Vehicle",
      href: vehicleSearchHref(row, options.canEditInventory ?? true),
    });
  }

  for (const row of customersRes.data ?? []) {
    const haystack = `${customerName(row)} ${row.email ?? ""} ${row.phone ?? ""}`;
    if (!matchesSearchQuery(haystack, q)) continue;
    results.push({
      id: `customer-${row.id}`,
      type: "customer",
      title: customerName(row),
      subtitle: [row.email, row.phone].filter(Boolean).join(" · "),
      badge: "Customer",
      href: platformPath(`customers/${row.id}`),
    });
  }

  const leadResults: AdminSearchResult[] = [];
  for (const row of preorderRes.data ?? []) {
    const vehicleLabel = vehicleTitleFromRow(row as Parameters<typeof vehicleTitleFromRow>[0]);
    const haystack = `${row.name ?? ""} ${row.email ?? ""} ${row.phone ?? ""} ${vehicleLabel} ${row.message ?? ""}`;
    if (!matchesSearchQuery(haystack, q)) continue;
    leadResults.push({
      id: `lead-preorder-${row.id}`,
      type: "lead",
      title: String(row.name ?? "Pre-order lead"),
      subtitle: [leadTypeLabel("preorder"), row.email, vehicleLabel].filter(Boolean).join(" · "),
      badge: leadTypeLabel("preorder"),
      href: platformPath(`leads/preorder/${row.id}`),
    });
  }

  for (const row of contactRes.data ?? []) {
    const haystack = `${row.name ?? ""} ${row.email ?? ""} ${row.subject ?? ""} ${row.message ?? ""}`;
    if (!matchesSearchQuery(haystack, q)) continue;
    leadResults.push({
      id: `lead-contact-${row.id}`,
      type: "lead",
      title: String(row.name ?? "Contact lead"),
      subtitle: [leadTypeLabel("contact"), row.email, row.subject].filter(Boolean).join(" · "),
      badge: leadTypeLabel("contact"),
      href: `${platformPath("leads")}?q=${encodeURIComponent(row.email ?? q)}`,
    });
  }

  for (const row of vehicleLeadRes.data ?? []) {
    const haystack = `${row.name ?? ""} ${row.email ?? ""} ${row.vehicle_name ?? ""} ${row.vehicle_slug ?? ""}`;
    if (!matchesSearchQuery(haystack, q)) continue;
    leadResults.push({
      id: `lead-vehicle-${row.id}`,
      type: "lead",
      title: String(row.name ?? "Vehicle inquiry"),
      subtitle: [leadTypeLabel("vehicle"), row.email, row.vehicle_name].filter(Boolean).join(" · "),
      badge: leadTypeLabel("vehicle"),
      href: `${platformPath("leads")}?q=${encodeURIComponent(row.email ?? q)}`,
    });
  }

  for (const row of financeRes.data ?? []) {
    const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
    const haystack = `${name} ${row.email ?? ""} ${row.phone ?? ""} ${row.vehicle_of_interest ?? ""}`;
    if (!matchesSearchQuery(haystack, q)) continue;
    leadResults.push({
      id: `lead-finance-${row.id}`,
      type: "lead",
      title: name || "Finance lead",
      subtitle: [leadTypeLabel("finance"), row.email, row.vehicle_of_interest].filter(Boolean).join(" · "),
      badge: leadTypeLabel("finance"),
      href: `${platformPath("leads")}?tab=finance&q=${encodeURIComponent(row.email ?? q)}`,
    });
  }

  for (const row of appraisalRes.data ?? []) {
    const haystack = `${row.seller_name ?? ""} ${row.seller_phone ?? ""} ${row.make ?? ""} ${row.model ?? ""} ${row.year ?? ""}`;
    if (!matchesSearchQuery(haystack, q)) continue;
    leadResults.push({
      id: `lead-appraisal-${row.id}`,
      type: "lead",
      title: String(row.seller_name ?? "Trade-in request"),
      subtitle: [leadTypeLabel("appraisal"), row.seller_phone, `${row.year} ${row.make} ${row.model}`]
        .filter(Boolean)
        .join(" · "),
      badge: leadTypeLabel("appraisal"),
      href: `${platformPath("leads")}?tab=appraisal&q=${encodeURIComponent(row.seller_name ?? q)}`,
    });
  }

  const trimmedLeads = leadResults.slice(0, limits.lead);
  const trimmedVehicles = results.filter((r) => r.type === "vehicle").slice(0, limits.vehicle);
  const trimmedCustomers = results.filter((r) => r.type === "customer").slice(0, limits.customer);

  const saleResults: AdminSearchResult[] = [];
  for (const row of salesRes.data ?? []) {
    const vehicle = row.vehicle as { year?: number; make?: string; model?: string } | null;
    const vehicleLabel = vehicle
      ? `${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim()
      : "";
    const haystack = `${row.customer_name ?? ""} ${row.customer_email ?? ""} ${vehicleLabel} ${row.status ?? ""}`;
    if (!matchesSearchQuery(haystack, q)) continue;
    saleResults.push({
      id: `sale-${row.id}`,
      type: "sale",
      title: row.customer_name ?? row.customer_email ?? "Sale",
      subtitle: [vehicleLabel, row.status].filter(Boolean).join(" · "),
      badge: "Sale",
      href: platformPath("sales"),
    });
  }

  const messageResults: AdminSearchResult[] = [];
  for (const row of messagesRes.data ?? []) {
    const haystack = `${row.customer_name} ${row.customer_email} ${row.subject} ${row.registration_id ?? ""} ${row.category}`;
    if (!matchesSearchQuery(haystack, q)) continue;
    messageResults.push({
      id: `message-${row.id}`,
      type: "message",
      title: row.subject || `Message from ${row.customer_name}`,
      subtitle: [row.customer_name, row.customer_email].filter(Boolean).join(" · "),
      badge: "Message",
      href: `${platformPath("messages")}?conversation=${encodeURIComponent(String(row.id))}`,
    });
  }

  const all = [
    ...trimmedVehicles,
    ...trimmedLeads,
    ...trimmedCustomers,
    ...saleResults.slice(0, limits.sale),
    ...messageResults.slice(0, limits.message),
  ];

  return { results: all, groups: groupSearchResults(all) };
}
