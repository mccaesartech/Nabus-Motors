import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildOrIlike,
  groupSearchResults,
  ilikePattern,
  SEARCH_FULL_LIMITS,
  SEARCH_LIMITS,
  type AdminSearchGroup,
  type AdminSearchResult,
  type AdminSearchResultType,
} from "@/lib/admin/search";
import {
  looksLikeIdQuery,
  looksLikeVinQuery,
  looksLikeYearQuery,
  rankByScore,
  scoreSearchRecord,
  type SearchField,
} from "@/lib/admin/search-ranking";
import { platformPath } from "@/lib/platform/paths";
import { ROUTES } from "@/lib/routes";
import { vehicleTitleFromRow } from "@/lib/platform/preorder";
import { leadTypeLabel } from "@/lib/platform/types";
import { notDeletedFilter } from "@/lib/platform/trash-types";

function customerName(row: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  name?: string | null;
}): string {
  if (row.name?.trim()) return row.name.trim();
  const full = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  return full || String(row.email ?? "Customer");
}

type SearchOptions = {
  full?: boolean;
  canEditInventory?: boolean;
  allowedTypes?: AdminSearchResultType[];
};

type ScoredResult = AdminSearchResult & { score: number };

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

function allowType(
  type: AdminSearchResultType,
  allowed: AdminSearchResultType[] | undefined
): boolean {
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(type);
}

function takeTopByType(
  scored: ScoredResult[],
  limits: typeof SEARCH_LIMITS | typeof SEARCH_FULL_LIMITS
): AdminSearchResult[] {
  const ranked = rankByScore(scored);
  const counts: Partial<Record<AdminSearchResultType, number>> = {};
  const out: AdminSearchResult[] = [];

  for (const item of ranked) {
    const used = counts[item.type] ?? 0;
    const limit = limits[item.type] ?? 5;
    if (used >= limit) continue;
    counts[item.type] = used + 1;
    const { score: _score, ...result } = item;
    void _score;
    out.push(result);
  }
  return out;
}

function pushScored(
  bucket: ScoredResult[],
  result: AdminSearchResult,
  fields: SearchField[],
  q: string
) {
  const score = scoreSearchRecord(fields, q);
  if (score < 70) return;
  bucket.push({ ...result, score });
}

export async function runAdminSearch(
  supabase: SupabaseClient,
  q: string,
  options: SearchOptions = {}
): Promise<{ results: AdminSearchResult[]; groups: AdminSearchGroup[]; hadError: boolean }> {
  const limits = options.full ? SEARCH_FULL_LIMITS : SEARCH_LIMITS;
  const pattern = ilikePattern(q);
  const yearQuery = looksLikeYearQuery(q) ? Number(q.trim()) : null;
  const idQuery = looksLikeIdQuery(q);
  const vinQuery = looksLikeVinQuery(q);
  const allowed = options.allowedTypes;
  const fetchMultiplier = 3;

  const scored: ScoredResult[] = [];
  const errors: boolean[] = [];

  async function runQuery<T>(
    enabled: boolean,
    promise: PromiseLike<{ data: T[] | null; error: { message: string } | null }>
  ): Promise<T[]> {
    if (!enabled) return [];
    const res = await promise;
    if (res.error) {
      errors.push(true);
      return [];
    }
    return res.data ?? [];
  }

  const vehicleOr = buildOrIlike(
    [
      "make",
      "model",
      "trim",
      "slug",
      "vin",
      "color",
      "body_type",
      "location",
      "description",
      "status",
    ],
    pattern
  );

  const profileOr = buildOrIlike(
    ["first_name", "last_name", "email", "phone", "registration_id"],
    pattern
  );

  const preorderOr = buildOrIlike(
    [
      "name",
      "email",
      "phone",
      "vehicle_title",
      "message",
      "vehicle_slug",
      "reference_code",
      "customer_registration_id",
    ],
    pattern
  );

  const contactOr = buildOrIlike(["name", "email", "phone", "subject", "message"], pattern);
  const vehicleLeadOr = buildOrIlike(
    ["name", "email", "phone", "vehicle_name", "vehicle_slug"],
    pattern
  );
  const financeOr = buildOrIlike(
    ["first_name", "last_name", "email", "phone", "vehicle_of_interest", "notes"],
    pattern
  );
  const appraisalOr = buildOrIlike(
    ["seller_name", "seller_phone", "make", "model", "notes"],
    pattern
  );
  const saleOr = buildOrIlike(
    ["customer_name", "customer_email", "status", "notes"],
    pattern
  );
  const messageOr = buildOrIlike(
    ["customer_name", "customer_email", "subject", "registration_id", "category"],
    pattern
  );
  const partsOr = buildOrIlike(
    ["name", "sku", "slug", "brand", "description", "status"],
    pattern
  );
  const orderOr = buildOrIlike(["name", "email", "phone", "status", "notes"], pattern);

  const [
    vehicles,
    profiles,
    preorders,
    contacts,
    vehicleLeads,
    finances,
    appraisals,
    sales,
    messages,
    parts,
    orders,
  ] = await Promise.all([
    runQuery(
      allowType("vehicle", allowed),
      notDeletedFilter(
        supabase
          .from("vehicles")
          .select(
            "id, year, make, model, trim, slug, vin, color, status, body_type, location, description"
          )
          .or(yearQuery !== null ? `${vehicleOr},year.eq.${yearQuery}` : vehicleOr)
      )
        .order("created_at", { ascending: false })
        .limit(limits.vehicle * fetchMultiplier)
    ),
    runQuery(
      allowType("customer", allowed),
      notDeletedFilter(
        supabase
          .from("profiles")
          .select("id, first_name, last_name, email, phone, registration_id")
          .or(profileOr)
      )
        .order("created_at", { ascending: false })
        .limit(limits.customer * fetchMultiplier)
    ),
    runQuery(
      allowType("lead", allowed),
      notDeletedFilter(
        supabase
          .from("preorder_inquiries")
          .select(
            "id, name, email, phone, vehicle_title, message, vehicle_slug, reference_code, customer_registration_id, is_custom_request"
          )
          .or(preorderOr)
      )
        .order("created_at", { ascending: false })
        .limit(Math.ceil((limits.lead * fetchMultiplier) / 2))
    ),
    runQuery(
      allowType("lead", allowed),
      notDeletedFilter(
        supabase
          .from("contact_inquiries")
          .select("id, name, email, phone, subject, message")
          .or(contactOr)
      )
        .order("created_at", { ascending: false })
        .limit(Math.ceil((limits.lead * fetchMultiplier) / 3))
    ),
    runQuery(
      allowType("lead", allowed),
      notDeletedFilter(
        supabase
          .from("vehicle_inquiries")
          .select("id, name, email, phone, vehicle_name, vehicle_slug")
          .or(vehicleLeadOr)
      )
        .order("created_at", { ascending: false })
        .limit(Math.ceil((limits.lead * fetchMultiplier) / 3))
    ),
    runQuery(
      allowType("lead", allowed),
      notDeletedFilter(
        supabase
          .from("finance_applications")
          .select("id, first_name, last_name, email, phone, vehicle_of_interest")
          .or(financeOr)
      )
        .order("created_at", { ascending: false })
        .limit(Math.ceil((limits.lead * fetchMultiplier) / 4))
    ),
    runQuery(
      allowType("lead", allowed),
      notDeletedFilter(
        supabase
          .from("appraisal_requests")
          .select("id, seller_name, seller_phone, make, model, year")
          .or(yearQuery !== null ? `${appraisalOr},year.eq.${yearQuery}` : appraisalOr)
      )
        .order("created_at", { ascending: false })
        .limit(Math.ceil((limits.lead * fetchMultiplier) / 4))
    ),
    runQuery(
      allowType("sale", allowed),
      notDeletedFilter(
        supabase
          .from("sales")
          .select(
            "id, customer_name, customer_email, status, notes, vehicle:vehicles(year, make, model)"
          )
          .or(
            idQuery
              ? `${saleOr},id.eq.${q.trim()}`
              : saleOr
          )
      )
        .order("created_at", { ascending: false })
        .limit(limits.sale * fetchMultiplier)
    ),
    runQuery(
      allowType("message", allowed),
      supabase
        .from("customer_conversations")
        .select("id, customer_name, customer_email, subject, category, status, registration_id")
        .or(messageOr)
        .order("updated_at", { ascending: false })
        .limit(limits.message * fetchMultiplier)
    ),
    runQuery(
      allowType("part", allowed),
      supabase
        .from("parts")
        .select("id, name, sku, slug, brand, status, stock_quantity")
        .or(partsOr)
        .order("updated_at", { ascending: false })
        .limit(limits.part * fetchMultiplier)
    ),
    runQuery(
      allowType("lead", allowed),
      notDeletedFilter(
        supabase
          .from("parts_orders")
          .select("id, name, email, phone, status, total_label, notes")
          .or(idQuery ? `${orderOr},id.eq.${q.trim()}` : orderOr)
      )
        .order("created_at", { ascending: false })
        .limit(Math.ceil((limits.lead * fetchMultiplier) / 3))
    ),
  ]);

  // Exact VIN / ID boosts via dedicated lookups when pattern search may miss separators.
  if (allowType("vehicle", allowed) && (vinQuery || idQuery)) {
    const exactVin = looksLikeVinQuery(q)
      ? await runQuery(
          true,
          notDeletedFilter(
            supabase
              .from("vehicles")
              .select(
                "id, year, make, model, trim, slug, vin, color, status, body_type, location, description"
              )
              .ilike("vin", `%${q.trim().replace(/[\s\-_.]/g, "")}%`)
          ).limit(5)
        )
      : [];
    const exactId = looksLikeIdQuery(q)
      ? await runQuery(
          true,
          notDeletedFilter(
            supabase
              .from("vehicles")
              .select(
                "id, year, make, model, trim, slug, vin, color, status, body_type, location, description"
              )
              .or(`id.eq.${q.trim()},slug.ilike.${ilikePattern(q)}`)
          ).limit(5)
        )
      : [];
    for (const row of [...exactVin, ...exactId]) {
      if (!vehicles.some((v) => v.id === row.id)) vehicles.push(row);
    }
  }

  for (const row of vehicles) {
    const title = `${row.year} ${row.make} ${row.model}${row.trim ? ` ${row.trim}` : ""}`;
    pushScored(
      scored,
      {
        id: `vehicle-${row.id}`,
        type: "vehicle",
        title,
        subtitle: [row.status, row.vin, row.color, row.location].filter(Boolean).join(" · "),
        badge: "Vehicle",
        href: vehicleSearchHref(row, options.canEditInventory ?? true),
      },
      [
        { value: title, kind: "text", weight: 1.2 },
        { value: row.vin, kind: "vin", weight: 1.5 },
        { value: row.slug, kind: "sku", weight: 1.3 },
        { value: row.id, kind: "id", weight: 1.4 },
        { value: row.color, kind: "text", weight: 1 },
        { value: row.make, kind: "text", weight: 1.1 },
        { value: row.model, kind: "text", weight: 1.1 },
        { value: row.year, kind: "year", weight: 1 },
        { value: row.body_type, kind: "text" },
        { value: row.location, kind: "text" },
        { value: row.status, kind: "text" },
        { value: row.description, kind: "text", weight: 0.6 },
      ],
      q
    );
  }

  for (const row of profiles) {
    const name = customerName(row);
    pushScored(
      scored,
      {
        id: `customer-${row.id}`,
        type: "customer",
        title: name,
        subtitle: [row.email, row.phone, row.registration_id].filter(Boolean).join(" · "),
        badge: "Customer",
        href: platformPath(`customers/${row.id}`),
      },
      [
        { value: name, kind: "text", weight: 1.2 },
        { value: row.email, kind: "email", weight: 1.3 },
        { value: row.phone, kind: "phone", weight: 1.3 },
        { value: row.registration_id, kind: "id", weight: 1.4 },
        { value: row.id, kind: "id", weight: 1.2 },
        { value: row.first_name, kind: "text" },
        { value: row.last_name, kind: "text" },
      ],
      q
    );
  }

  for (const row of preorders) {
    const vehicleLabel =
      row.vehicle_title ??
      (row.vehicle_slug ? String(row.vehicle_slug).replace(/-/g, " ") : "");
    pushScored(
      scored,
      {
        id: `lead-preorder-${row.id}`,
        type: "lead",
        title: String(row.name ?? "Pre-order lead"),
        subtitle: [row.email, row.phone, row.reference_code, vehicleLabel]
          .filter(Boolean)
          .join(" · "),
        badge: leadTypeLabel("preorder", Boolean(row.is_custom_request)),
        href: platformPath(`leads/preorder/${row.id}`),
      },
      [
        { value: row.name, kind: "text", weight: 1.2 },
        { value: row.email, kind: "email", weight: 1.3 },
        { value: row.phone, kind: "phone", weight: 1.3 },
        { value: row.reference_code, kind: "id", weight: 1.5 },
        { value: row.customer_registration_id, kind: "id", weight: 1.3 },
        { value: row.id, kind: "id", weight: 1.4 },
        { value: vehicleLabel, kind: "text" },
        { value: row.message, kind: "text", weight: 0.5 },
      ],
      q
    );
  }

  for (const row of contacts) {
    pushScored(
      scored,
      {
        id: `lead-contact-${row.id}`,
        type: "lead",
        title: String(row.name ?? "Contact lead"),
        subtitle: [row.email, row.phone, row.subject].filter(Boolean).join(" · "),
        badge: leadTypeLabel("contact"),
        href: `${platformPath("leads")}?tab=contact&q=${encodeURIComponent(row.email ?? q)}`,
      },
      [
        { value: row.name, kind: "text", weight: 1.2 },
        { value: row.email, kind: "email", weight: 1.3 },
        { value: row.phone, kind: "phone", weight: 1.3 },
        { value: row.id, kind: "id", weight: 1.4 },
        { value: row.subject, kind: "text" },
        { value: row.message, kind: "text", weight: 0.5 },
      ],
      q
    );
  }

  for (const row of vehicleLeads) {
    pushScored(
      scored,
      {
        id: `lead-vehicle-${row.id}`,
        type: "lead",
        title: String(row.name ?? "Vehicle inquiry"),
        subtitle: [row.email, row.phone, row.vehicle_name ?? row.vehicle_slug]
          .filter(Boolean)
          .join(" · "),
        badge: leadTypeLabel("vehicle"),
        href: `${platformPath("leads")}?tab=vehicle&q=${encodeURIComponent(row.email ?? q)}`,
      },
      [
        { value: row.name, kind: "text", weight: 1.2 },
        { value: row.email, kind: "email", weight: 1.3 },
        { value: row.phone, kind: "phone", weight: 1.3 },
        { value: row.id, kind: "id", weight: 1.4 },
        { value: row.vehicle_name, kind: "text" },
        { value: row.vehicle_slug, kind: "sku" },
      ],
      q
    );
  }

  for (const row of finances) {
    const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Finance lead";
    pushScored(
      scored,
      {
        id: `lead-finance-${row.id}`,
        type: "lead",
        title: name,
        subtitle: [row.email, row.phone, row.vehicle_of_interest].filter(Boolean).join(" · "),
        badge: leadTypeLabel("finance"),
        href: `${platformPath("leads")}?tab=finance&q=${encodeURIComponent(row.email ?? q)}`,
      },
      [
        { value: name, kind: "text", weight: 1.2 },
        { value: row.email, kind: "email", weight: 1.3 },
        { value: row.phone, kind: "phone", weight: 1.3 },
        { value: row.id, kind: "id", weight: 1.4 },
        { value: row.vehicle_of_interest, kind: "text" },
      ],
      q
    );
  }

  for (const row of appraisals) {
    const vehicle = `${row.year ?? ""} ${row.make ?? ""} ${row.model ?? ""}`.trim();
    pushScored(
      scored,
      {
        id: `lead-appraisal-${row.id}`,
        type: "lead",
        title: String(row.seller_name ?? "Trade-in request"),
        subtitle: [row.seller_phone, vehicle].filter(Boolean).join(" · "),
        badge: leadTypeLabel("appraisal"),
        href: `${platformPath("leads")}?tab=appraisal&q=${encodeURIComponent(row.seller_name ?? q)}`,
      },
      [
        { value: row.seller_name, kind: "text", weight: 1.2 },
        { value: row.seller_phone, kind: "phone", weight: 1.3 },
        { value: row.id, kind: "id", weight: 1.4 },
        { value: vehicle, kind: "text" },
        { value: row.make, kind: "text" },
        { value: row.model, kind: "text" },
        { value: row.year, kind: "year" },
      ],
      q
    );
  }

  for (const row of orders) {
    pushScored(
      scored,
      {
        id: `lead-order-${row.id}`,
        type: "lead",
        title: String(row.name ?? row.email ?? "Cart order"),
        subtitle: [row.email, row.phone, row.status, row.total_label].filter(Boolean).join(" · "),
        badge: leadTypeLabel("order"),
        href: `${platformPath("leads")}?tab=order&order=${encodeURIComponent(String(row.id))}`,
      },
      [
        { value: row.name, kind: "text", weight: 1.2 },
        { value: row.email, kind: "email", weight: 1.3 },
        { value: row.phone, kind: "phone", weight: 1.3 },
        { value: row.id, kind: "id", weight: 1.5 },
        { value: row.status, kind: "text" },
        { value: row.notes, kind: "text", weight: 0.5 },
      ],
      q
    );
  }

  for (const row of sales) {
    const vehicle = row.vehicle as
      | { year?: number; make?: string; model?: string }
      | null
      | undefined;
    const vehicleLabel = vehicle
      ? `${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim()
      : "";

    pushScored(
      scored,
      {
        id: `sale-${row.id}`,
        type: "sale",
        title: row.customer_name ?? row.customer_email ?? "Sale",
        subtitle: [vehicleLabel, row.status].filter(Boolean).join(" · "),
        badge: "Sale",
        href: `${platformPath("sales")}?q=${encodeURIComponent(row.customer_name ?? row.customer_email ?? q)}`,
      },
      [
        { value: row.customer_name, kind: "text", weight: 1.2 },
        { value: row.customer_email, kind: "email", weight: 1.3 },
        { value: row.id, kind: "id", weight: 1.5 },
        { value: vehicleLabel, kind: "text" },
        { value: row.status, kind: "text" },
        { value: row.notes, kind: "text", weight: 0.5 },
      ],
      q
    );
  }

  for (const row of messages) {
    pushScored(
      scored,
      {
        id: `message-${row.id}`,
        type: "message",
        title: row.subject || `Message from ${row.customer_name}`,
        subtitle: [row.customer_name, row.customer_email, row.registration_id, row.category]
          .filter(Boolean)
          .join(" · "),
        badge: "Message",
        href: `${platformPath("messages")}?conversation=${encodeURIComponent(String(row.id))}`,
      },
      [
        { value: row.customer_name, kind: "text", weight: 1.2 },
        { value: row.customer_email, kind: "email", weight: 1.3 },
        { value: row.subject, kind: "text" },
        { value: row.registration_id, kind: "id", weight: 1.4 },
        { value: row.id, kind: "id", weight: 1.3 },
        { value: row.category, kind: "text", weight: 0.7 },
      ],
      q
    );
  }

  for (const row of parts) {
    pushScored(
      scored,
      {
        id: `part-${row.id}`,
        type: "part",
        title: String(row.name ?? "Part"),
        subtitle: [row.sku, row.brand, row.status, row.stock_quantity != null ? `Qty ${row.stock_quantity}` : null]
          .filter(Boolean)
          .join(" · "),
        badge: "Part",
        href: platformPath("parts/inventory"),
      },
      [
        { value: row.name, kind: "text", weight: 1.2 },
        { value: row.sku, kind: "sku", weight: 1.5 },
        { value: row.slug, kind: "sku", weight: 1.2 },
        { value: row.brand, kind: "text" },
        { value: row.id, kind: "id", weight: 1.3 },
        { value: row.status, kind: "text", weight: 0.6 },
      ],
      q
    );
  }

  const results = takeTopByType(scored, limits);
  const groups = groupSearchResults(results);
  const hadError = errors.length > 0;

  return { results, groups, hadError };
}

/** Fallback when ilike OR filters fail (e.g. missing columns). */
export async function runAdminSearchFallback(
  supabase: SupabaseClient,
  q: string,
  options: SearchOptions = {}
): Promise<{ results: AdminSearchResult[]; groups: AdminSearchGroup[] }> {
  const limits = options.full ? SEARCH_FULL_LIMITS : SEARCH_LIMITS;
  const allowed = options.allowedTypes;
  const scored: ScoredResult[] = [];

  const [vehiclesRes, profilesRes, preorderRes, contactRes, vehicleLeadRes, financeRes, appraisalRes, salesRes, messagesRes, partsRes, ordersRes] =
    await Promise.all([
      allowType("vehicle", allowed)
        ? notDeletedFilter(
            supabase
              .from("vehicles")
              .select(
                "id, year, make, model, trim, slug, vin, color, status, body_type, location, description"
              )
          )
            .order("created_at", { ascending: false })
            .limit(400)
        : Promise.resolve({ data: [] as never[], error: null }),
      allowType("customer", allowed)
        ? notDeletedFilter(
            supabase
              .from("profiles")
              .select("id, first_name, last_name, email, phone, registration_id")
          )
            .order("created_at", { ascending: false })
            .limit(300)
        : Promise.resolve({ data: [] as never[], error: null }),
      allowType("lead", allowed)
        ? notDeletedFilter(
            supabase
              .from("preorder_inquiries")
              .select(
                "id, name, email, phone, vehicle_title, message, vehicle_slug, reference_code, is_custom_request"
              )
          )
            .order("created_at", { ascending: false })
            .limit(150)
        : Promise.resolve({ data: [] as never[], error: null }),
      allowType("lead", allowed)
        ? notDeletedFilter(
            supabase.from("contact_inquiries").select("id, name, email, phone, subject, message")
          )
            .order("created_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] as never[], error: null }),
      allowType("lead", allowed)
        ? notDeletedFilter(
            supabase
              .from("vehicle_inquiries")
              .select("id, name, email, phone, vehicle_name, vehicle_slug")
          )
            .order("created_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] as never[], error: null }),
      allowType("lead", allowed)
        ? notDeletedFilter(
            supabase
              .from("finance_applications")
              .select("id, first_name, last_name, email, phone, vehicle_of_interest")
          )
            .order("created_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] as never[], error: null }),
      allowType("lead", allowed)
        ? notDeletedFilter(
            supabase
              .from("appraisal_requests")
              .select("id, seller_name, seller_phone, make, model, year")
          )
            .order("created_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] as never[], error: null }),
      allowType("sale", allowed)
        ? notDeletedFilter(
            supabase
              .from("sales")
              .select(
                "id, customer_name, customer_email, status, notes, vehicle:vehicles(year, make, model)"
              )
          )
            .order("created_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] as never[], error: null }),
      allowType("message", allowed)
        ? supabase
            .from("customer_conversations")
            .select("id, customer_name, customer_email, subject, category, status, registration_id")
            .order("updated_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] as never[], error: null }),
      allowType("part", allowed)
        ? supabase
            .from("parts")
            .select("id, name, sku, slug, brand, status, stock_quantity")
            .order("updated_at", { ascending: false })
            .limit(150)
        : Promise.resolve({ data: [] as never[], error: null }),
      allowType("lead", allowed)
        ? notDeletedFilter(
            supabase
              .from("parts_orders")
              .select("id, name, email, phone, status, total_label, notes")
          )
            .order("created_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] as never[], error: null }),
    ]);

  for (const row of vehiclesRes.data ?? []) {
    const title = `${row.year} ${row.make} ${row.model}${row.trim ? ` ${row.trim}` : ""}`;
    pushScored(
      scored,
      {
        id: `vehicle-${row.id}`,
        type: "vehicle",
        title,
        subtitle: [row.status, row.vin, row.color].filter(Boolean).join(" · "),
        badge: "Vehicle",
        href: vehicleSearchHref(row, options.canEditInventory ?? true),
      },
      [
        { value: title, kind: "text", weight: 1.2 },
        { value: row.vin, kind: "vin", weight: 1.5 },
        { value: row.slug, kind: "sku", weight: 1.3 },
        { value: row.color, kind: "text" },
        { value: row.description, kind: "text", weight: 0.5 },
        { value: row.status, kind: "text" },
        { value: row.location, kind: "text" },
      ],
      q
    );
  }

  for (const row of profilesRes.data ?? []) {
    pushScored(
      scored,
      {
        id: `customer-${row.id}`,
        type: "customer",
        title: customerName(row),
        subtitle: [row.email, row.phone, row.registration_id].filter(Boolean).join(" · "),
        badge: "Customer",
        href: platformPath(`customers/${row.id}`),
      },
      [
        { value: customerName(row), kind: "text", weight: 1.2 },
        { value: row.email, kind: "email", weight: 1.3 },
        { value: row.phone, kind: "phone", weight: 1.3 },
        { value: row.registration_id, kind: "id", weight: 1.4 },
      ],
      q
    );
  }

  for (const row of preorderRes.data ?? []) {
    const vehicleLabel = vehicleTitleFromRow(row as Parameters<typeof vehicleTitleFromRow>[0]);
    pushScored(
      scored,
      {
        id: `lead-preorder-${row.id}`,
        type: "lead",
        title: String(row.name ?? "Pre-order lead"),
        subtitle: [leadTypeLabel("preorder"), row.email, row.reference_code, vehicleLabel]
          .filter(Boolean)
          .join(" · "),
        badge: leadTypeLabel("preorder", Boolean(row.is_custom_request)),
        href: platformPath(`leads/preorder/${row.id}`),
      },
      [
        { value: row.name, kind: "text", weight: 1.2 },
        { value: row.email, kind: "email", weight: 1.3 },
        { value: row.phone, kind: "phone", weight: 1.3 },
        { value: row.reference_code, kind: "id", weight: 1.5 },
        { value: vehicleLabel, kind: "text" },
        { value: row.message, kind: "text", weight: 0.5 },
      ],
      q
    );
  }

  for (const row of contactRes.data ?? []) {
    pushScored(
      scored,
      {
        id: `lead-contact-${row.id}`,
        type: "lead",
        title: String(row.name ?? "Contact lead"),
        subtitle: [leadTypeLabel("contact"), row.email, row.subject].filter(Boolean).join(" · "),
        badge: leadTypeLabel("contact"),
        href: `${platformPath("leads")}?tab=contact&q=${encodeURIComponent(row.email ?? q)}`,
      },
      [
        { value: row.name, kind: "text", weight: 1.2 },
        { value: row.email, kind: "email", weight: 1.3 },
        { value: row.phone, kind: "phone", weight: 1.3 },
        { value: row.subject, kind: "text" },
        { value: row.message, kind: "text", weight: 0.5 },
      ],
      q
    );
  }

  for (const row of vehicleLeadRes.data ?? []) {
    pushScored(
      scored,
      {
        id: `lead-vehicle-${row.id}`,
        type: "lead",
        title: String(row.name ?? "Vehicle inquiry"),
        subtitle: [leadTypeLabel("vehicle"), row.email, row.vehicle_name].filter(Boolean).join(" · "),
        badge: leadTypeLabel("vehicle"),
        href: `${platformPath("leads")}?tab=vehicle&q=${encodeURIComponent(row.email ?? q)}`,
      },
      [
        { value: row.name, kind: "text", weight: 1.2 },
        { value: row.email, kind: "email", weight: 1.3 },
        { value: row.phone, kind: "phone", weight: 1.3 },
        { value: row.vehicle_name, kind: "text" },
        { value: row.vehicle_slug, kind: "sku" },
      ],
      q
    );
  }

  for (const row of financeRes.data ?? []) {
    const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
    pushScored(
      scored,
      {
        id: `lead-finance-${row.id}`,
        type: "lead",
        title: name || "Finance lead",
        subtitle: [leadTypeLabel("finance"), row.email, row.vehicle_of_interest]
          .filter(Boolean)
          .join(" · "),
        badge: leadTypeLabel("finance"),
        href: `${platformPath("leads")}?tab=finance&q=${encodeURIComponent(row.email ?? q)}`,
      },
      [
        { value: name, kind: "text", weight: 1.2 },
        { value: row.email, kind: "email", weight: 1.3 },
        { value: row.phone, kind: "phone", weight: 1.3 },
        { value: row.vehicle_of_interest, kind: "text" },
      ],
      q
    );
  }

  for (const row of appraisalRes.data ?? []) {
    pushScored(
      scored,
      {
        id: `lead-appraisal-${row.id}`,
        type: "lead",
        title: String(row.seller_name ?? "Trade-in request"),
        subtitle: [
          leadTypeLabel("appraisal"),
          row.seller_phone,
          `${row.year} ${row.make} ${row.model}`,
        ]
          .filter(Boolean)
          .join(" · "),
        badge: leadTypeLabel("appraisal"),
        href: `${platformPath("leads")}?tab=appraisal&q=${encodeURIComponent(row.seller_name ?? q)}`,
      },
      [
        { value: row.seller_name, kind: "text", weight: 1.2 },
        { value: row.seller_phone, kind: "phone", weight: 1.3 },
        { value: `${row.year} ${row.make} ${row.model}`, kind: "text" },
      ],
      q
    );
  }

  for (const row of ordersRes.data ?? []) {
    pushScored(
      scored,
      {
        id: `lead-order-${row.id}`,
        type: "lead",
        title: String(row.name ?? row.email ?? "Cart order"),
        subtitle: [row.email, row.status].filter(Boolean).join(" · "),
        badge: leadTypeLabel("order"),
        href: `${platformPath("leads")}?tab=order&order=${encodeURIComponent(String(row.id))}`,
      },
      [
        { value: row.name, kind: "text", weight: 1.2 },
        { value: row.email, kind: "email", weight: 1.3 },
        { value: row.phone, kind: "phone", weight: 1.3 },
        { value: row.id, kind: "id", weight: 1.5 },
      ],
      q
    );
  }

  for (const row of salesRes.data ?? []) {
    const vehicle = row.vehicle as { year?: number; make?: string; model?: string } | null;
    const vehicleLabel = vehicle
      ? `${vehicle.year ?? ""} ${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim()
      : "";
    pushScored(
      scored,
      {
        id: `sale-${row.id}`,
        type: "sale",
        title: row.customer_name ?? row.customer_email ?? "Sale",
        subtitle: [vehicleLabel, row.status].filter(Boolean).join(" · "),
        badge: "Sale",
        href: `${platformPath("sales")}?q=${encodeURIComponent(row.customer_name ?? row.customer_email ?? q)}`,
      },
      [
        { value: row.customer_name, kind: "text", weight: 1.2 },
        { value: row.customer_email, kind: "email", weight: 1.3 },
        { value: row.id, kind: "id", weight: 1.5 },
        { value: vehicleLabel, kind: "text" },
        { value: row.status, kind: "text" },
      ],
      q
    );
  }

  for (const row of messagesRes.data ?? []) {
    pushScored(
      scored,
      {
        id: `message-${row.id}`,
        type: "message",
        title: row.subject || `Message from ${row.customer_name}`,
        subtitle: [row.customer_name, row.customer_email].filter(Boolean).join(" · "),
        badge: "Message",
        href: `${platformPath("messages")}?conversation=${encodeURIComponent(String(row.id))}`,
      },
      [
        { value: row.customer_name, kind: "text", weight: 1.2 },
        { value: row.customer_email, kind: "email", weight: 1.3 },
        { value: row.subject, kind: "text" },
        { value: row.registration_id, kind: "id", weight: 1.4 },
      ],
      q
    );
  }

  for (const row of partsRes.data ?? []) {
    pushScored(
      scored,
      {
        id: `part-${row.id}`,
        type: "part",
        title: String(row.name ?? "Part"),
        subtitle: [row.sku, row.brand, row.status].filter(Boolean).join(" · "),
        badge: "Part",
        href: platformPath("parts/inventory"),
      },
      [
        { value: row.name, kind: "text", weight: 1.2 },
        { value: row.sku, kind: "sku", weight: 1.5 },
        { value: row.slug, kind: "sku" },
        { value: row.brand, kind: "text" },
      ],
      q
    );
  }

  const results = takeTopByType(scored, limits);
  return { results, groups: groupSearchResults(results) };
}
