export type PreferredContact = "email" | "phone" | "whatsapp";

export type CustomerProfileUpdateInput = {
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
  addressLine?: unknown;
  city?: unknown;
  country?: unknown;
  preferredContact?: unknown;
};

export type CustomerProfileUpdate = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address_line: string | null;
  city: string | null;
  country: string | null;
  preferred_contact: PreferredContact | null;
};

const NAME_MAX = 80;
const PHONE_MAX = 32;
const ADDRESS_MAX = 160;
const CITY_MAX = 80;
const COUNTRY_MAX = 80;

const PREFERRED_CONTACTS = new Set<PreferredContact>(["email", "phone", "whatsapp"]);

function cleanText(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  if (trimmed.length > max) return undefined;
  return trimmed;
}

/** Accept common international phone shapes; store trimmed digits/+ / spaces / dashes. */
export function isValidCustomerPhone(phone: string): boolean {
  const compact = phone.replace(/[\s().-]/g, "");
  if (!/^\+?[0-9]{7,15}$/.test(compact)) return false;
  return true;
}

export function parsePreferredContact(
  value: unknown
): PreferredContact | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (!PREFERRED_CONTACTS.has(normalized as PreferredContact)) return undefined;
  return normalized as PreferredContact;
}

export function parseCustomerProfileUpdate(
  body: CustomerProfileUpdateInput
):
  | { ok: true; update: CustomerProfileUpdate }
  | { ok: false; message: string } {
  const firstName = cleanText(body.firstName, NAME_MAX);
  const lastName = cleanText(body.lastName, NAME_MAX);
  const phoneRaw = cleanText(body.phone, PHONE_MAX);
  const addressLine = cleanText(body.addressLine, ADDRESS_MAX);
  const city = cleanText(body.city, CITY_MAX);
  const country = cleanText(body.country, COUNTRY_MAX);
  const preferredContact = parsePreferredContact(body.preferredContact);

  if (body.firstName !== undefined && firstName === undefined) {
    return { ok: false, message: "Enter a valid first name (max 80 characters)." };
  }
  if (body.lastName !== undefined && lastName === undefined) {
    return { ok: false, message: "Enter a valid last name (max 80 characters)." };
  }
  if (body.phone !== undefined && phoneRaw === undefined) {
    return { ok: false, message: "Enter a valid phone number (max 32 characters)." };
  }
  if (phoneRaw && !isValidCustomerPhone(phoneRaw)) {
    return {
      ok: false,
      message: "Enter a valid phone number with 7–15 digits (optional + country code).",
    };
  }
  if (body.addressLine !== undefined && addressLine === undefined) {
    return { ok: false, message: "Enter a valid address (max 160 characters)." };
  }
  if (body.city !== undefined && city === undefined) {
    return { ok: false, message: "Enter a valid city (max 80 characters)." };
  }
  if (body.country !== undefined && country === undefined) {
    return { ok: false, message: "Enter a valid country (max 80 characters)." };
  }
  if (body.preferredContact !== undefined && preferredContact === undefined) {
    return {
      ok: false,
      message: "Choose email, phone, or WhatsApp as your preferred contact.",
    };
  }

  if (
    body.firstName === undefined &&
    body.lastName === undefined &&
    body.phone === undefined &&
    body.addressLine === undefined &&
    body.city === undefined &&
    body.country === undefined &&
    body.preferredContact === undefined
  ) {
    return { ok: false, message: "No profile changes provided." };
  }

  const update: CustomerProfileUpdate = {
    first_name: firstName === undefined ? null : firstName,
    last_name: lastName === undefined ? null : lastName,
    phone: phoneRaw === undefined ? null : phoneRaw,
    address_line: addressLine === undefined ? null : addressLine,
    city: city === undefined ? null : city,
    country: country === undefined ? null : country,
    preferred_contact: preferredContact === undefined ? null : preferredContact,
  };

  return { ok: true, update };
}

export function mergeProfileUpdate(
  current: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    address_line?: string | null;
    city?: string | null;
    country?: string | null;
    preferred_contact?: PreferredContact | null;
  },
  body: CustomerProfileUpdateInput
):
  | { ok: true; next: CustomerProfileUpdate }
  | { ok: false; message: string } {
  const parsed = parseCustomerProfileUpdate(body);
  if (!parsed.ok) return parsed;

  const next: CustomerProfileUpdate = {
    first_name:
      body.firstName === undefined ? current.first_name : parsed.update.first_name,
    last_name:
      body.lastName === undefined ? current.last_name : parsed.update.last_name,
    phone: body.phone === undefined ? current.phone : parsed.update.phone,
    address_line:
      body.addressLine === undefined
        ? (current.address_line ?? null)
        : parsed.update.address_line,
    city: body.city === undefined ? (current.city ?? null) : parsed.update.city,
    country:
      body.country === undefined ? (current.country ?? null) : parsed.update.country,
    preferred_contact:
      body.preferredContact === undefined
        ? (current.preferred_contact ?? null)
        : parsed.update.preferred_contact,
  };

  if (body.firstName !== undefined && !next.first_name) {
    return { ok: false, message: "First name is required." };
  }

  return { ok: true, next };
}

export function customerAvatarUrl(
  userMetadata: Record<string, unknown> | null | undefined
): string | null {
  if (!userMetadata) return null;
  for (const key of ["avatar_url", "picture", "avatar"]) {
    const value = userMetadata[key];
    if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) {
      return value.trim();
    }
  }
  return null;
}

/** Prefer uploaded profile avatar; fall back to OAuth metadata picture. */
export function resolveCustomerAvatarUrl(opts: {
  profileAvatarUrl?: string | null;
  userMetadata?: Record<string, unknown> | null;
}): string | null {
  const uploaded = opts.profileAvatarUrl?.trim();
  if (uploaded && /^https?:\/\//i.test(uploaded)) return uploaded;
  return customerAvatarUrl(opts.userMetadata);
}

export function customerAuthProviderLabel(
  user: {
    app_metadata?: Record<string, unknown> | null;
    identities?: Array<{ provider?: string }> | null;
  } | null
): string {
  const metaProvider = user?.app_metadata?.provider;
  if (typeof metaProvider === "string" && metaProvider.trim()) {
    return formatAuthProvider(metaProvider);
  }
  const identityProvider = user?.identities?.[0]?.provider;
  if (typeof identityProvider === "string" && identityProvider.trim()) {
    return formatAuthProvider(identityProvider);
  }
  return "Email";
}

function formatAuthProvider(provider: string): string {
  const normalized = provider.trim().toLowerCase();
  if (normalized === "google") return "Google";
  if (normalized === "email" || normalized === "password") return "Email";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function formatMemberSince(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
