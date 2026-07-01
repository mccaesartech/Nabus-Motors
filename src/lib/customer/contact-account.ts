import type { User } from "@supabase/supabase-js";
import {
  ensureCustomerProfile,
  linkCustomerFreightQuotesByEmail,
  linkCustomerPreordersByEmail,
  waitForCustomerProfile,
} from "@/lib/customer/preorder-account";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type ResolvedCustomerProfile = {
  userId: string;
  email: string;
  name: string;
  registration_id: string | null;
};

function displayNameFromProfile(profile: {
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
}): string {
  const fromProfile = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fromProfile) return fromProfile;
  return profile.email?.split("@")[0] ?? "Customer";
}

function mapProfileRow(profile: {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  registration_id: string | null;
}): ResolvedCustomerProfile {
  const email = profile.email ?? "";
  return {
    userId: profile.id,
    email,
    name: displayNameFromProfile({
      first_name: profile.first_name,
      last_name: profile.last_name,
      email,
    }),
    registration_id: profile.registration_id ?? null,
  };
}

function isExistingAccountError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already registered") ||
    normalized.includes("already been registered") ||
    normalized.includes("user already exists") ||
    normalized.includes("already exists")
  );
}

async function lookupCustomerNameFromInquiries(
  supabase: ReturnType<typeof createAdminSupabase>,
  email: string
): Promise<string | null> {
  if (!supabase) return null;

  const normalized = email.trim().toLowerCase();
  const tables: Array<{ table: string; nameField: string }> = [
    { table: "parts_orders", nameField: "name" },
    { table: "preorder_inquiries", nameField: "name" },
    { table: "contact_inquiries", nameField: "name" },
    { table: "vehicle_inquiries", nameField: "name" },
    { table: "finance_applications", nameField: "first_name" },
  ];

  for (const { table, nameField } of tables) {
    const { data } = await supabase
      .from(table)
      .select(nameField === "first_name" ? "first_name, last_name" : nameField)
      .ilike("email", normalized)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) continue;

    if (nameField === "first_name") {
      const row = data as { first_name?: string | null; last_name?: string | null };
      const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
      if (name) return name;
      continue;
    }

    const name = String((data as unknown as Record<string, unknown>)[nameField] ?? "").trim();
    if (name) return name;
  }

  return null;
}

export async function resolveCustomerProfile(
  opts: { userId?: string; email?: string }
): Promise<ResolvedCustomerProfile | null> {
  const supabase = createAdminSupabase();
  if (!supabase) return null;

  if (opts.userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, phone, registration_id")
      .eq("id", opts.userId)
      .maybeSingle();
    if (!profile) return null;

    const { data: authUser } = await supabase.auth.admin.getUserById(opts.userId);
    const email = profile.email ?? authUser?.user?.email ?? "";
    if (!email) return null;

    return mapProfileRow({ ...profile, email });
  }

  if (opts.email) {
    const normalized = opts.email.trim().toLowerCase();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, phone, registration_id")
      .ilike("email", normalized)
      .maybeSingle();

    if (profile) {
      return mapProfileRow({
        ...profile,
        email: profile.email ?? normalized,
      });
    }
  }

  return null;
}

/** Create or resolve a customer auth profile so staff can message cart / guest leads. */
export async function ensureCustomerRecordForContact(opts: {
  userId?: string;
  email?: string;
  name?: string;
  phone?: string;
}): Promise<ResolvedCustomerProfile | null> {
  const supabase = createAdminSupabase();
  if (!supabase) return null;

  const resolved = await resolveCustomerProfile({
    userId: opts.userId,
    email: opts.email,
  });
  if (resolved) {
    if (opts.name?.trim() || opts.phone?.trim()) {
      await ensureCustomerProfile(
        resolved.userId,
        resolved.email,
        opts.name?.trim() || resolved.name,
        opts.phone
      );
      return (
        (await resolveCustomerProfile({ userId: resolved.userId })) ?? resolved
      );
    }
    return resolved;
  }

  const email = (opts.email ?? "").trim().toLowerCase();
  if (!email) return null;

  const { data: listed } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const existingAuth = listed?.users?.find(
    (user) => user.email?.trim().toLowerCase() === email
  );

  if (existingAuth) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, registration_id")
      .eq("id", existingAuth.id)
      .maybeSingle();

    const name =
      opts.name?.trim() ||
      (await lookupCustomerNameFromInquiries(supabase, email)) ||
      email.split("@")[0] ||
      "Customer";

    if (profile) {
      if (!profile.email) {
        await supabase.from("profiles").update({ email }).eq("id", profile.id);
      }
      await ensureCustomerProfile(existingAuth.id, email, name, opts.phone);
      return resolveCustomerProfile({ userId: existingAuth.id });
    }

    const spacePos = name.indexOf(" ");
    await supabase.from("profiles").upsert(
      {
        id: existingAuth.id,
        email,
        first_name: spacePos > 0 ? name.slice(0, spacePos) : name,
        last_name: spacePos > 0 ? name.slice(spacePos + 1).trim() : null,
        phone: opts.phone?.trim() || null,
      },
      { onConflict: "id" }
    );

    return resolveCustomerProfile({ userId: existingAuth.id });
  }

  const name =
    opts.name?.trim() ||
    (await lookupCustomerNameFromInquiries(supabase, email)) ||
    email.split("@")[0] ||
    "Customer";

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: name, phone: opts.phone?.trim() ?? "" },
  });

  if (createError) {
    if (!isExistingAccountError(createError.message)) {
      console.warn("[contact-account] createUser failed:", createError.message);
      return null;
    }

    const retryListed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const retryUser = retryListed.data?.users?.find(
      (user) => user.email?.trim().toLowerCase() === email
    );
    if (retryUser) {
      return ensureCustomerRecordForContact({
        userId: retryUser.id,
        name,
        phone: opts.phone,
      });
    }
    return null;
  }

  if (!created.user) return null;

  await ensureCustomerProfile(created.user.id, email, name, opts.phone);
  await waitForCustomerProfile(created.user.id);
  await linkCustomerPreordersByEmail(created.user.id, email, null);
  await linkCustomerFreightQuotesByEmail(created.user.id, email, null);
  await linkCustomerPartsOrdersByEmail(created.user.id, email);

  return resolveCustomerProfile({ userId: created.user.id });
}

/** Link orphan cart orders (no user_id) to the customer account by email. */
export async function linkCustomerPartsOrdersByEmail(
  userId: string,
  email: string
): Promise<number> {
  const admin = createAdminSupabase();
  if (!admin) return 0;

  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await admin
    .from("parts_orders")
    .update({ user_id: userId })
    .is("user_id", null)
    .ilike("email", normalizedEmail)
    .select("id");

  if (error) {
    console.warn("[cart] link orders by email failed:", error.message);
    return 0;
  }

  return data?.length ?? 0;
}

export type CartCheckoutCustomerResult = {
  userId: string | null;
  registrationId: string | null;
};

/** Resolve logged-in or guest cart checkout to a linkable customer record. */
export async function resolveCartCheckoutCustomer({
  authUser,
  email,
  name,
  phone,
}: {
  authUser: User | null;
  email: string;
  name: string;
  phone?: string;
}): Promise<CartCheckoutCustomerResult> {
  if (authUser) {
    const registrationId = await ensureCustomerProfile(
      authUser.id,
      email,
      name,
      phone
    );
    await linkCustomerPartsOrdersByEmail(authUser.id, email);
    return { userId: authUser.id, registrationId };
  }

  const record = await ensureCustomerRecordForContact({
    email,
    name,
    phone,
  });

  if (!record) {
    return { userId: null, registrationId: null };
  }

  await linkCustomerPartsOrdersByEmail(record.userId, email);
  return {
    userId: record.userId,
    registrationId: record.registration_id,
  };
}
