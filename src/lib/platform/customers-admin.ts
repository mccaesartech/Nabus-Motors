import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPlatformPrice } from "@/lib/currency";
import { getStaticFallbackRates, type ExchangeRateMap } from "@/lib/currency/rates";

export type AdminCustomerListItem = {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  phone: string | null;
  whatsappOptIn: boolean | null;
  registrationId: string | null;
  accountCreatedAt: string | null;
  quotesCount: number;
  preordersCount: number;
  ordersCount: number;
  shipmentsCount: number;
  deletedAt: string | null;
};

export type AdminCustomerQuote = {
  id: string;
  referenceCode: string | null;
  serviceType: string;
  status: string;
  originCountry: string | null;
  destination: string | null;
  cargoDescription: string | null;
  cargoSize: string | null;
  estimatedValueLabel: string | null;
  message: string | null;
  createdAt: string;
};

export type AdminCustomerPreorder = {
  id: string;
  referenceCode: string | null;
  status: string;
  vehicleLabel: string | null;
  message: string | null;
  isCustomRequest: boolean;
  createdAt: string;
};

export type AdminCustomerShipment = {
  id: string;
  trackingNumber: string;
  status: string;
  destination: string | null;
  createdAt: string;
};

export type AdminCustomerOrderItem = {
  name: string;
  quantity: number;
  itemType: "part" | "vehicle";
  itemIntent: "buy" | "pre_order" | null;
  lineTotalLabel: string;
};

export type AdminCustomerOrder = {
  id: string;
  status: string;
  totalLabel: string;
  itemCount: number;
  notes: string | null;
  items: AdminCustomerOrderItem[];
  createdAt: string;
};

export type AdminCustomerInquiry = {
  id: string;
  type: "contact" | "vehicle" | "finance" | "appraisal";
  label: string;
  summary: string;
  status: string;
  createdAt: string;
};

export type AdminCustomerDetail = AdminCustomerListItem & {
  inquiriesCount: number;
  recentQuotes: AdminCustomerQuote[];
  recentPreorders: AdminCustomerPreorder[];
  recentOrders: AdminCustomerOrder[];
  recentShipments: AdminCustomerShipment[];
  recentInquiries: AdminCustomerInquiry[];
};

type ProfileRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  registration_id: string | null;
  whatsapp_opt_in: boolean | null;
  created_at: string | null;
  deleted_at: string | null;
};

type QuoteRow = {
  id: string;
  user_id: string | null;
  email: string;
  name: string;
  phone: string | null;
  whatsapp_opt_in: boolean | null;
  customer_registration_id: string | null;
  reference_code: string | null;
  service_type: string;
  status: string;
  origin_country: string | null;
  destination: string | null;
  cargo_description: string | null;
  cargo_size: string | null;
  estimated_value_usd: number | null;
  message: string | null;
  created_at: string;
};

type PreorderRow = {
  id: string;
  user_id: string | null;
  email: string;
  name: string;
  phone: string | null;
  whatsapp_opt_in: boolean | null;
  customer_registration_id: string | null;
  reference_code: string | null;
  status: string | null;
  vehicle_name: string | null;
  vehicle_slug: string | null;
  message: string | null;
  is_custom_request: boolean | null;
  created_at: string | null;
};

type PartsOrderItemRow = {
  id: string;
  item_type: string;
  part_name: string;
  quantity: number;
  unit_price_usd: number;
  item_intent: string | null;
};

type PartsOrderRow = {
  id: string;
  user_id: string | null;
  email: string;
  name: string;
  phone: string | null;
  status: string;
  total_usd: number | null;
  notes: string | null;
  created_at: string;
  parts_order_items?: PartsOrderItemRow[];
};

type ShipmentRow = {
  id: string;
  user_id: string | null;
  customer_email: string | null;
  tracking_number: string;
  status: string;
  destination: string | null;
  created_at: string | null;
};

function profileName(row: ProfileRow): string {
  const full = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  return full || row.email || "Customer";
}

function emailKey(email: string) {
  return email.trim().toLowerCase();
}

function applyCustomerScope<T extends { or: (filter: string) => T; ilike: (col: string, val: string) => T }>(
  query: T,
  profile: ProfileRow | null,
  emailFromKey: string | null,
  emailColumn: string
): T {
  if (profile?.email) {
    return query.or(`user_id.eq.${profile.id},${emailColumn}.ilike.${profile.email}`);
  }
  if (emailFromKey) {
    return query.ilike(emailColumn, emailFromKey);
  }
  return query;
}

function mapOrderItems(
  order: PartsOrderRow,
  rates: ExchangeRateMap
): AdminCustomerOrderItem[] {
  return (order.parts_order_items ?? []).map((item) => {
    const quantity = Number(item.quantity) || 1;
    const unitUsd = Number(item.unit_price_usd) || 0;
    const itemType = item.item_type === "vehicle" ? "vehicle" : "part";
    const itemIntent =
      item.item_intent === "pre_order" || item.item_intent === "buy"
        ? item.item_intent
        : null;
    return {
      name: item.part_name,
      quantity,
      itemType,
      itemIntent,
      lineTotalLabel: formatPlatformPrice(unitUsd * quantity, rates),
    };
  });
}

function mapCustomerInquiries(rows: {
  contact: Record<string, unknown>[];
  vehicle: Record<string, unknown>[];
  finance: Record<string, unknown>[];
  appraisal: Record<string, unknown>[];
}): AdminCustomerInquiry[] {
  const mapped: AdminCustomerInquiry[] = [];

  for (const row of rows.contact) {
    mapped.push({
      id: String(row.id),
      type: "contact",
      label: String(row.subject ?? "Contact message"),
      summary: String(row.message ?? ""),
      status: String(row.status ?? "new"),
      createdAt: String(row.created_at ?? ""),
    });
  }

  for (const row of rows.vehicle) {
    mapped.push({
      id: String(row.id),
      type: "vehicle",
      label: String(row.vehicle_name ?? row.vehicle_slug ?? "Vehicle inquiry"),
      summary: String(row.message ?? ""),
      status: String(row.status ?? "new"),
      createdAt: String(row.created_at ?? ""),
    });
  }

  for (const row of rows.finance) {
    const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Finance application";
    mapped.push({
      id: String(row.id),
      type: "finance",
      label: name,
      summary: [
        row.vehicle_of_interest ? `Vehicle: ${row.vehicle_of_interest}` : null,
        row.annual_income_range ? `Income: ${row.annual_income_range}` : null,
        row.credit_score_range ? `Credit: ${row.credit_score_range}` : null,
        row.notes ? String(row.notes) : null,
      ]
        .filter(Boolean)
        .join(" · "),
      status: String(row.status ?? "new"),
      createdAt: String(row.created_at ?? ""),
    });
  }

  for (const row of rows.appraisal) {
    mapped.push({
      id: String(row.id),
      type: "appraisal",
      label: `${row.year ?? ""} ${row.make ?? ""} ${row.model ?? ""}`.trim() || "Trade-in appraisal",
      summary: [
        row.mileage != null ? `${Number(row.mileage).toLocaleString()} km` : null,
        row.condition ? String(row.condition) : null,
        row.notes ? String(row.notes) : null,
      ]
        .filter(Boolean)
        .join(" · "),
      status: String(row.status ?? "new"),
      createdAt: String(row.created_at ?? ""),
    });
  }

  return mapped
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);
}

function countByUserAndEmail(
  rows: Array<{ user_id: string | null; email?: string; customer_email?: string | null }>,
  userId: string | null,
  email: string
) {
  const normalized = emailKey(email);
  return rows.filter((row) => {
    const rowEmail = row.email ?? row.customer_email ?? "";
    return (userId && row.user_id === userId) || emailKey(rowEmail) === normalized;
  }).length;
}

function matchesSearch(
  customer: AdminCustomerListItem,
  quoteRefs: string[],
  query: string
): boolean {
  const q = query.toLowerCase();
  return (
    customer.name.toLowerCase().includes(q) ||
    customer.email.toLowerCase().includes(q) ||
    (customer.phone?.toLowerCase().includes(q) ?? false) ||
    (customer.registrationId?.toLowerCase().includes(q) ?? false) ||
    quoteRefs.some((ref) => ref.toLowerCase().includes(q))
  );
}

export type FetchAdminCustomersOptions = {
  search?: string;
  showDeleted?: boolean;
  /** When false (default), hide registered profiles with no quotes, pre-orders, orders, or shipments. */
  showSignUpsWithoutActivity?: boolean;
};

/** True when the customer has at least one linked business record. */
export function hasCustomerActivity(customer: Pick<
  AdminCustomerListItem,
  "quotesCount" | "preordersCount" | "ordersCount" | "shipmentsCount"
>): boolean {
  return (
    customer.quotesCount > 0 ||
    customer.preordersCount > 0 ||
    customer.ordersCount > 0 ||
    customer.shipmentsCount > 0
  );
}

async function loadPermanentlyDeletedCustomerEmails(
  supabase: SupabaseClient
): Promise<Set<string>> {
  const { data } = await supabase
    .from("platform_trash")
    .select("entity_id, snapshot")
    .eq("entity_type", "customer")
    .not("permanently_deleted_at", "is", null);

  const emails = new Set<string>();
  for (const row of data ?? []) {
    const entityId = String(row.entity_id ?? "");
    if (entityId.startsWith("email:")) {
      emails.add(emailKey(entityId.slice(6)));
    }
    const snapshot = (row.snapshot ?? {}) as Record<string, unknown>;
    if (typeof snapshot.email === "string" && snapshot.email.trim()) {
      emails.add(emailKey(snapshot.email));
    }
    const profile = snapshot.profile as Record<string, unknown> | undefined;
    if (typeof profile?.email === "string" && profile.email.trim()) {
      emails.add(emailKey(String(profile.email)));
    }
  }
  return emails;
}

async function loadDeletedCustomerEmails(supabase: SupabaseClient) {
  const [{ data }, permanentlyDeletedEmails] = await Promise.all([
    supabase.from("deleted_customer_emails").select("email, deleted_at"),
    loadPermanentlyDeletedCustomerEmails(supabase),
  ]);

  const deletedAtByEmail = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.email && row.deleted_at) {
      const key = emailKey(String(row.email));
      if (permanentlyDeletedEmails.has(key)) continue;
      deletedAtByEmail.set(key, String(row.deleted_at));
    }
  }
  return deletedAtByEmail;
}

function isCustomerPermanentlyRemoved(
  customerEmail: string,
  permanentlyDeletedEmails: Set<string>
): boolean {
  return permanentlyDeletedEmails.has(emailKey(customerEmail));
}

function isCustomerDeleted(
  customerEmail: string,
  profileDeletedAt: string | null | undefined,
  deletedAtByEmail: Map<string, string>,
  permanentlyDeletedEmails: Set<string>
): boolean {
  const key = emailKey(customerEmail);
  // Permanently purged customers are excluded separately — they are neither
  // active nor soft-deleted ("Show deleted").
  if (permanentlyDeletedEmails.has(key)) return false;
  if (profileDeletedAt) return true;
  return deletedAtByEmail.has(key);
}

function customerDeletedAt(
  customerEmail: string,
  profileDeletedAt: string | null | undefined,
  deletedAtByEmail: Map<string, string>,
  permanentlyDeletedEmails: Set<string>
): string | null {
  const key = emailKey(customerEmail);
  if (permanentlyDeletedEmails.has(key)) return null;
  if (profileDeletedAt) return profileDeletedAt;
  return deletedAtByEmail.get(key) ?? null;
}

export async function fetchAdminCustomers(
  supabase: SupabaseClient,
  options?: FetchAdminCustomersOptions | string
): Promise<AdminCustomerListItem[]> {
  const normalizedOptions: FetchAdminCustomersOptions =
    typeof options === "string" ? { search: options } : (options ?? {});
  const { search, showDeleted = false, showSignUpsWithoutActivity = false } =
    normalizedOptions;

  const [deletedAtByEmail, permanentlyDeletedEmails] = await Promise.all([
    loadDeletedCustomerEmails(supabase),
    loadPermanentlyDeletedCustomerEmails(supabase),
  ]);

  const [
    { data: profiles },
    { data: quotes },
    { data: preorders },
    { data: shipments },
    { data: partsOrders },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, email, first_name, last_name, phone, registration_id, whatsapp_opt_in, created_at, deleted_at"
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("freight_quote_requests")
      .select(
        "id, user_id, email, name, phone, whatsapp_opt_in, customer_registration_id, reference_code, service_type, status, origin_country, destination, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("preorder_inquiries")
      .select(
        "id, user_id, email, name, phone, whatsapp_opt_in, customer_registration_id, reference_code, status, vehicle_name, vehicle_slug, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("shipment_tracking")
      .select("id, user_id, customer_email, tracking_number, status, destination, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("parts_orders")
      .select(
        "id, user_id, email, name, phone, status, total_usd, created_at, parts_order_items ( id )"
      )
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const profileRows = (profiles ?? []) as ProfileRow[];
  const quoteRows = (quotes ?? []) as QuoteRow[];
  const preorderRows = (preorders ?? []) as PreorderRow[];
  const shipmentRows = (shipments ?? []) as ShipmentRow[];
  const partsOrderRows = (partsOrders ?? []) as PartsOrderRow[];

  const customers = new Map<string, AdminCustomerListItem>();
  const quoteRefsByCustomer = new Map<string, string[]>();

  for (const profile of profileRows) {
    if (!profile.email) continue;
    const profileEmail = profile.email;
    // Permanent trash delete must never resurrect via profiles or activity.
    if (isCustomerPermanentlyRemoved(profileEmail, permanentlyDeletedEmails)) continue;
    const deleted = isCustomerDeleted(
      profileEmail,
      profile.deleted_at,
      deletedAtByEmail,
      permanentlyDeletedEmails
    );
    if (deleted && !showDeleted) continue;
    const key = profile.id;
    customers.set(key, {
      id: profile.id,
      userId: profile.id,
      name: profileName(profile),
      email: profileEmail,
      phone: profile.phone,
      whatsappOptIn: profile.whatsapp_opt_in,
      registrationId: profile.registration_id,
      accountCreatedAt: profile.created_at,
      quotesCount: countByUserAndEmail(quoteRows, profile.id, profileEmail),
      preordersCount: countByUserAndEmail(preorderRows, profile.id, profileEmail),
      ordersCount: countByUserAndEmail(partsOrderRows, profile.id, profileEmail),
      shipmentsCount: countByUserAndEmail(shipmentRows, profile.id, profileEmail),
      deletedAt: customerDeletedAt(
        profileEmail,
        profile.deleted_at,
        deletedAtByEmail,
        permanentlyDeletedEmails
      ),
    });
    quoteRefsByCustomer.set(
      key,
      quoteRows
        .filter(
          (q) => q.user_id === profile.id || emailKey(q.email) === emailKey(profileEmail)
        )
        .map((q) => q.reference_code)
        .filter((ref): ref is string => Boolean(ref))
    );
  }

  const addOrphan = (row: {
    email: string;
    name: string;
    phone: string | null;
    whatsapp_opt_in: boolean | null;
    customer_registration_id: string | null;
    user_id: string | null;
    created_at: string | null;
  }) => {
    const normalized = emailKey(row.email);
    const existingByUser = row.user_id ? customers.get(row.user_id) : null;
    const existingByEmail = Array.from(customers.values()).find(
      (c) => emailKey(c.email) === normalized
    );
    if (existingByUser || existingByEmail) return;

    if (isCustomerPermanentlyRemoved(row.email, permanentlyDeletedEmails)) return;

    const deleted = isCustomerDeleted(
      row.email,
      null,
      deletedAtByEmail,
      permanentlyDeletedEmails
    );
    if (deleted && !showDeleted) return;

    const id = row.user_id ?? `email:${normalized}`;
    if (customers.has(id)) return;

    customers.set(id, {
      id,
      userId: row.user_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      whatsappOptIn: row.whatsapp_opt_in,
      registrationId: row.customer_registration_id,
      accountCreatedAt: row.created_at,
      quotesCount: countByUserAndEmail(quoteRows, row.user_id, row.email),
      preordersCount: countByUserAndEmail(preorderRows, row.user_id, row.email),
      ordersCount: countByUserAndEmail(partsOrderRows, row.user_id, row.email),
      shipmentsCount: countByUserAndEmail(shipmentRows, row.user_id, row.email),
      deletedAt: customerDeletedAt(
        row.email,
        null,
        deletedAtByEmail,
        permanentlyDeletedEmails
      ),
    });
    quoteRefsByCustomer.set(
      id,
      quoteRows
        .filter((q) => emailKey(q.email) === normalized)
        .map((q) => q.reference_code)
        .filter((ref): ref is string => Boolean(ref))
    );
  };

  for (const quote of quoteRows) addOrphan(quote);
  for (const preorder of preorderRows) addOrphan(preorder);
  for (const order of partsOrderRows) {
    addOrphan({
      email: order.email,
      name: order.name,
      phone: order.phone,
      whatsapp_opt_in: null,
      customer_registration_id: null,
      user_id: order.user_id,
      created_at: order.created_at,
    });
  }

  let list = Array.from(customers.values()).sort((a, b) => {
    const aDate = a.accountCreatedAt ?? "";
    const bDate = b.accountCreatedAt ?? "";
    return bDate.localeCompare(aDate);
  });

  const trimmedSearch = search?.trim();
  if (trimmedSearch) {
    list = list.filter((customer) =>
      matchesSearch(customer, quoteRefsByCustomer.get(customer.id) ?? [], trimmedSearch)
    );
  }

  // Default: show customers with business activity only. Search and the explicit
  // toggle still surface pure sign-ups so admins can verify new registrations.
  const includeSignUpsOnly =
    showSignUpsWithoutActivity || Boolean(trimmedSearch);
  if (!includeSignUpsOnly) {
    list = list.filter(hasCustomerActivity);
  }

  return list;
}

export async function deleteAdminCustomer(
  supabase: SupabaseClient,
  id: string,
  deletedBy: string
): Promise<{ ok: true; name: string; email: string } | { ok: false; message: string }> {
  const customer = await fetchAdminCustomerDetail(supabase, id, { includeDeleted: true });
  if (!customer) {
    return { ok: false, message: "Customer not found." };
  }

  if (customer.deletedAt) {
    return { ok: false, message: "Customer is already deleted." };
  }

  const normalizedEmail = emailKey(customer.email);
  const now = new Date().toISOString();

  if (customer.userId) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        deleted_at: now,
        // Keep Account Lifecycle in sync — deleted_at alone left status='active'.
        account_status: "deleted",
        first_name: "Deleted",
        last_name: "customer",
        phone: null,
        updated_at: now,
      })
      .eq("id", customer.userId);

    if (profileError) {
      return { ok: false, message: profileError.message };
    }

  }

  const { error: deletedEmailError } = await supabase.from("deleted_customer_emails").upsert(
    {
      email: normalizedEmail,
      deleted_at: now,
      deleted_by: deletedBy,
    },
    { onConflict: "email" }
  );

  if (deletedEmailError) {
    return { ok: false, message: deletedEmailError.message };
  }

  return { ok: true, name: customer.name, email: customer.email };
}

export async function fetchAdminCustomerDetail(
  supabase: SupabaseClient,
  id: string,
  options?: { includeDeleted?: boolean; rates?: ExchangeRateMap }
): Promise<AdminCustomerDetail | null> {
  const includeDeleted = options?.includeDeleted ?? false;
  const rates = options?.rates ?? getStaticFallbackRates();
  const decodedId = decodeURIComponent(id);
  const isEmailKey = decodedId.startsWith("email:");

  let profile: ProfileRow | null = null;
  if (!isEmailKey) {
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, email, first_name, last_name, phone, registration_id, whatsapp_opt_in, created_at, deleted_at"
      )
      .eq("id", decodedId)
      .maybeSingle();
    profile = (data as ProfileRow | null) ?? null;
  }

  const [deletedAtByEmail, permanentlyDeletedEmails] = await Promise.all([
    loadDeletedCustomerEmails(supabase),
    loadPermanentlyDeletedCustomerEmails(supabase),
  ]);

  const emailFromKey = isEmailKey ? decodedId.slice("email:".length) : null;

  const quoteQuery = supabase
    .from("freight_quote_requests")
    .select(
      "id, user_id, email, name, phone, whatsapp_opt_in, customer_registration_id, reference_code, service_type, status, origin_country, destination, cargo_description, cargo_size, estimated_value_usd, message, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const preorderQuery = supabase
    .from("preorder_inquiries")
    .select(
      "id, user_id, email, name, phone, whatsapp_opt_in, customer_registration_id, reference_code, status, vehicle_name, vehicle_slug, message, is_custom_request, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const partsOrderQuery = supabase
    .from("parts_orders")
    .select(
      "id, user_id, email, name, phone, status, total_usd, notes, created_at, parts_order_items ( id, item_type, part_name, quantity, unit_price_usd, item_intent )"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const shipmentQuery = supabase
    .from("shipment_tracking")
    .select("id, user_id, customer_email, tracking_number, status, destination, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const contactInquiryQuery = supabase
    .from("contact_inquiries")
    .select("id, subject, message, status, created_at, user_id, email")
    .order("created_at", { ascending: false })
    .limit(20);

  const vehicleInquiryQuery = supabase
    .from("vehicle_inquiries")
    .select("id, vehicle_name, vehicle_slug, message, status, created_at, user_id, email")
    .order("created_at", { ascending: false })
    .limit(20);

  const financeInquiryQuery = supabase
    .from("finance_applications")
    .select(
      "id, first_name, last_name, vehicle_of_interest, annual_income_range, credit_score_range, notes, status, created_at, user_id, email"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const appraisalInquiryQuery = supabase
    .from("appraisal_requests")
    .select(
      "id, year, make, model, mileage, condition, notes, status, created_at, seller_phone"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  if (profile) {
    applyCustomerScope(quoteQuery, profile, null, "email");
    applyCustomerScope(preorderQuery, profile, null, "email");
    applyCustomerScope(partsOrderQuery, profile, null, "email");
    applyCustomerScope(shipmentQuery, profile, null, "customer_email");
    applyCustomerScope(contactInquiryQuery, profile, null, "email");
    applyCustomerScope(vehicleInquiryQuery, profile, null, "email");
    applyCustomerScope(financeInquiryQuery, profile, null, "email");
    if (profile.phone) {
      appraisalInquiryQuery.eq("seller_phone", profile.phone);
    } else {
      appraisalInquiryQuery.limit(0);
    }
  } else if (emailFromKey) {
    quoteQuery.ilike("email", emailFromKey);
    preorderQuery.ilike("email", emailFromKey);
    partsOrderQuery.ilike("email", emailFromKey);
    shipmentQuery.ilike("customer_email", emailFromKey);
    contactInquiryQuery.ilike("email", emailFromKey);
    vehicleInquiryQuery.ilike("email", emailFromKey);
    financeInquiryQuery.ilike("email", emailFromKey);
    appraisalInquiryQuery.limit(0);
  } else {
    return null;
  }

  const [
    { data: quotes },
    { data: preorders },
    { data: shipments },
    { data: partsOrders },
    { data: contactInquiries },
    { data: vehicleInquiries },
    { data: financeInquiries },
    { data: appraisalInquiries },
  ] = await Promise.all([
    quoteQuery,
    preorderQuery,
    shipmentQuery,
    partsOrderQuery,
    contactInquiryQuery,
    vehicleInquiryQuery,
    financeInquiryQuery,
    appraisalInquiryQuery,
  ]);

  const quoteRows = (quotes ?? []) as QuoteRow[];
  const preorderRows = (preorders ?? []) as PreorderRow[];
  const shipmentRows = (shipments ?? []) as ShipmentRow[];
  const partsOrderRows = (partsOrders ?? []) as PartsOrderRow[];
  const recentInquiries = mapCustomerInquiries({
    contact: (contactInquiries ?? []) as Record<string, unknown>[],
    vehicle: (vehicleInquiries ?? []) as Record<string, unknown>[],
    finance: (financeInquiries ?? []) as Record<string, unknown>[],
    appraisal: (appraisalInquiries ?? []) as Record<string, unknown>[],
  });

  if (
    !profile &&
    quoteRows.length === 0 &&
    preorderRows.length === 0 &&
    partsOrderRows.length === 0 &&
    recentInquiries.length === 0
  ) {
    return null;
  }

  const seed = profile
    ? {
        id: profile.id,
        userId: profile.id,
        name: profileName(profile),
        email: profile.email ?? "",
        phone: profile.phone,
        whatsappOptIn: profile.whatsapp_opt_in,
        registrationId: profile.registration_id,
        accountCreatedAt: profile.created_at,
      }
    : {
        id: decodedId,
        userId:
          quoteRows[0]?.user_id ??
          preorderRows[0]?.user_id ??
          partsOrderRows[0]?.user_id ??
          null,
        name:
          quoteRows[0]?.name ??
          preorderRows[0]?.name ??
          partsOrderRows[0]?.name ??
          "Customer",
        email:
          emailFromKey ??
          quoteRows[0]?.email ??
          preorderRows[0]?.email ??
          partsOrderRows[0]?.email ??
          "",
        phone:
          quoteRows[0]?.phone ??
          preorderRows[0]?.phone ??
          partsOrderRows[0]?.phone ??
          null,
        whatsappOptIn: quoteRows[0]?.whatsapp_opt_in ?? preorderRows[0]?.whatsapp_opt_in ?? null,
        registrationId:
          quoteRows[0]?.customer_registration_id ??
          preorderRows[0]?.customer_registration_id ??
          null,
        accountCreatedAt:
          quoteRows[0]?.created_at ??
          preorderRows[0]?.created_at ??
          partsOrderRows[0]?.created_at ??
          null,
      };

  if (!seed.email) return null;

  // Permanent trash delete: never return in detail (active or "Show deleted").
  if (isCustomerPermanentlyRemoved(seed.email, permanentlyDeletedEmails)) {
    return null;
  }

  const deletedAt = customerDeletedAt(
    seed.email,
    profile?.deleted_at,
    deletedAtByEmail,
    permanentlyDeletedEmails
  );
  if (deletedAt && !includeDeleted) {
    return null;
  }

  const allCustomers = await fetchAdminCustomers(supabase, { showDeleted: includeDeleted });
  const counts =
    allCustomers.find((c) => c.id === seed.id) ??
    allCustomers.find((c) => emailKey(c.email) === emailKey(seed.email));

  return {
    ...seed,
    quotesCount: counts?.quotesCount ?? quoteRows.length,
    preordersCount: counts?.preordersCount ?? preorderRows.length,
    ordersCount: counts?.ordersCount ?? partsOrderRows.length,
    shipmentsCount: counts?.shipmentsCount ?? shipmentRows.length,
    inquiriesCount: recentInquiries.length,
    deletedAt,
    recentQuotes: quoteRows.map((q) => ({
      id: q.id,
      referenceCode: q.reference_code,
      serviceType: q.service_type,
      status: q.status,
      originCountry: q.origin_country,
      destination: q.destination,
      cargoDescription: q.cargo_description,
      cargoSize: q.cargo_size,
      estimatedValueLabel:
        q.estimated_value_usd != null
          ? formatPlatformPrice(Number(q.estimated_value_usd), rates)
          : null,
      message: q.message,
      createdAt: q.created_at,
    })),
    recentPreorders: preorderRows.map((p) => ({
      id: p.id,
      referenceCode: p.reference_code,
      status: p.status ?? "new",
      vehicleLabel: p.vehicle_name ?? p.vehicle_slug,
      message: p.message,
      isCustomRequest: Boolean(p.is_custom_request),
      createdAt: p.created_at ?? "",
    })),
    recentOrders: partsOrderRows.map((order) => ({
      id: order.id,
      status: order.status,
      totalLabel: formatPlatformPrice(Number(order.total_usd) || 0, rates),
      itemCount: order.parts_order_items?.length ?? 0,
      notes: order.notes,
      items: mapOrderItems(order, rates),
      createdAt: order.created_at,
    })),
    recentShipments: shipmentRows.map((s) => ({
      id: s.id,
      trackingNumber: s.tracking_number,
      status: s.status,
      destination: s.destination,
      createdAt: s.created_at ?? "",
    })),
    recentInquiries,
  };
}
