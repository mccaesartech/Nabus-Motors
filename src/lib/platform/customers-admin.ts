import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPlatformPrice } from "@/lib/currency";

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
  createdAt: string;
};

export type AdminCustomerPreorder = {
  id: string;
  referenceCode: string | null;
  status: string;
  vehicleLabel: string | null;
  createdAt: string;
};

export type AdminCustomerShipment = {
  id: string;
  trackingNumber: string;
  status: string;
  destination: string | null;
  createdAt: string;
};

export type AdminCustomerOrder = {
  id: string;
  status: string;
  totalLabel: string;
  itemCount: number;
  createdAt: string;
};

export type AdminCustomerDetail = AdminCustomerListItem & {
  recentQuotes: AdminCustomerQuote[];
  recentPreorders: AdminCustomerPreorder[];
  recentOrders: AdminCustomerOrder[];
  recentShipments: AdminCustomerShipment[];
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
  created_at: string | null;
};

type PartsOrderRow = {
  id: string;
  user_id: string | null;
  email: string;
  name: string;
  phone: string | null;
  status: string;
  total_usd: number | null;
  created_at: string;
  parts_order_items?: Array<{ id: string }>;
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
};

async function loadDeletedCustomerEmails(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("deleted_customer_emails")
    .select("email, deleted_at");

  const deletedAtByEmail = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.email && row.deleted_at) {
      deletedAtByEmail.set(emailKey(String(row.email)), String(row.deleted_at));
    }
  }
  return deletedAtByEmail;
}

function isCustomerDeleted(
  customerEmail: string,
  profileDeletedAt: string | null | undefined,
  deletedAtByEmail: Map<string, string>
): boolean {
  if (profileDeletedAt) return true;
  return deletedAtByEmail.has(emailKey(customerEmail));
}

function customerDeletedAt(
  customerEmail: string,
  profileDeletedAt: string | null | undefined,
  deletedAtByEmail: Map<string, string>
): string | null {
  if (profileDeletedAt) return profileDeletedAt;
  return deletedAtByEmail.get(emailKey(customerEmail)) ?? null;
}

export async function fetchAdminCustomers(
  supabase: SupabaseClient,
  options?: FetchAdminCustomersOptions | string
): Promise<AdminCustomerListItem[]> {
  const normalizedOptions: FetchAdminCustomersOptions =
    typeof options === "string" ? { search: options } : (options ?? {});
  const { search, showDeleted = false } = normalizedOptions;

  const deletedAtByEmail = await loadDeletedCustomerEmails(supabase);

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
    const deleted = isCustomerDeleted(profileEmail, profile.deleted_at, deletedAtByEmail);
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
      deletedAt: customerDeletedAt(profileEmail, profile.deleted_at, deletedAtByEmail),
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

    const deleted = isCustomerDeleted(row.email, null, deletedAtByEmail);
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
      deletedAt: customerDeletedAt(row.email, null, deletedAtByEmail),
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
        first_name: "Deleted",
        last_name: "customer",
        phone: null,
        updated_at: now,
      })
      .eq("id", customer.userId);

    if (profileError) {
      return { ok: false, message: profileError.message };
    }

    const { error: authError } = await supabase.auth.admin.updateUserById(customer.userId, {
      ban_duration: "876000h",
      user_metadata: { account_deleted: true },
    });

    if (authError && !/not found|User not found/i.test(authError.message)) {
      return { ok: false, message: authError.message };
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
  options?: { includeDeleted?: boolean }
): Promise<AdminCustomerDetail | null> {
  const includeDeleted = options?.includeDeleted ?? false;
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

  const deletedAtByEmail = await loadDeletedCustomerEmails(supabase);

  const emailFromKey = isEmailKey ? decodedId.slice("email:".length) : null;

  const quoteQuery = supabase
    .from("freight_quote_requests")
    .select(
      "id, user_id, email, name, phone, whatsapp_opt_in, customer_registration_id, reference_code, service_type, status, origin_country, destination, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const preorderQuery = supabase
    .from("preorder_inquiries")
    .select(
      "id, user_id, email, name, phone, whatsapp_opt_in, customer_registration_id, reference_code, status, vehicle_name, vehicle_slug, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const partsOrderQuery = supabase
    .from("parts_orders")
    .select(
      "id, user_id, email, name, phone, status, total_usd, created_at, parts_order_items ( id )"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const shipmentQuery = supabase
    .from("shipment_tracking")
    .select("id, user_id, customer_email, tracking_number, status, destination, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (profile) {
    quoteQuery.or(`user_id.eq.${profile.id},email.ilike.${profile.email}`);
    preorderQuery.or(`user_id.eq.${profile.id},email.ilike.${profile.email}`);
    partsOrderQuery.or(`user_id.eq.${profile.id},email.ilike.${profile.email}`);
    shipmentQuery.or(`user_id.eq.${profile.id},customer_email.ilike.${profile.email}`);
  } else if (emailFromKey) {
    quoteQuery.ilike("email", emailFromKey);
    preorderQuery.ilike("email", emailFromKey);
    partsOrderQuery.ilike("email", emailFromKey);
    shipmentQuery.ilike("customer_email", emailFromKey);
  } else {
    return null;
  }

  const [{ data: quotes }, { data: preorders }, { data: shipments }, { data: partsOrders }] =
    await Promise.all([quoteQuery, preorderQuery, shipmentQuery, partsOrderQuery]);

  const quoteRows = (quotes ?? []) as QuoteRow[];
  const preorderRows = (preorders ?? []) as PreorderRow[];
  const shipmentRows = (shipments ?? []) as ShipmentRow[];
  const partsOrderRows = (partsOrders ?? []) as PartsOrderRow[];

  if (!profile && quoteRows.length === 0 && preorderRows.length === 0 && partsOrderRows.length === 0) {
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

  const deletedAt = customerDeletedAt(
    seed.email,
    profile?.deleted_at,
    deletedAtByEmail
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
    deletedAt,
    recentQuotes: quoteRows.map((q) => ({
      id: q.id,
      referenceCode: q.reference_code,
      serviceType: q.service_type,
      status: q.status,
      originCountry: q.origin_country,
      destination: q.destination,
      createdAt: q.created_at,
    })),
    recentPreorders: preorderRows.map((p) => ({
      id: p.id,
      referenceCode: p.reference_code,
      status: p.status ?? "new",
      vehicleLabel: p.vehicle_name ?? p.vehicle_slug,
      createdAt: p.created_at ?? "",
    })),
    recentOrders: partsOrderRows.map((order) => ({
      id: order.id,
      status: order.status,
      totalLabel: formatPlatformPrice(Number(order.total_usd) || 0),
      itemCount: order.parts_order_items?.length ?? 0,
      createdAt: order.created_at,
    })),
    recentShipments: shipmentRows.map((s) => ({
      id: s.id,
      trackingNumber: s.tracking_number,
      status: s.status,
      destination: s.destination,
      createdAt: s.created_at ?? "",
    })),
  };
}
