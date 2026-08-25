import { describe, expect, it } from "vitest";
import {
  customerAuthProviderLabel,
  customerAvatarUrl,
  formatMemberSince,
  isValidCustomerPhone,
  mergeProfileUpdate,
  parseCustomerProfileUpdate,
  resolveCustomerAvatarUrl,
} from "@/lib/customer/profile";

describe("isValidCustomerPhone", () => {
  it("accepts local and international numbers", () => {
    expect(isValidCustomerPhone("0244123456")).toBe(true);
    expect(isValidCustomerPhone("+233 24 412 3456")).toBe(true);
    expect(isValidCustomerPhone("(024) 412-3456")).toBe(true);
  });

  it("rejects short or invalid values", () => {
    expect(isValidCustomerPhone("123")).toBe(false);
    expect(isValidCustomerPhone("abc1234567")).toBe(false);
  });
});

describe("parseCustomerProfileUpdate", () => {
  it("rejects empty payloads", () => {
    expect(parseCustomerProfileUpdate({}).ok).toBe(false);
  });

  it("normalizes names, phone, address, and preferred contact", () => {
    const result = parseCustomerProfileUpdate({
      firstName: "  Ama  ",
      lastName: "Mensah",
      phone: "+233 24 412 3456",
      addressLine: "  12 Ring Road  ",
      city: "Accra",
      country: "Ghana",
      preferredContact: "whatsapp",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.update).toEqual({
      first_name: "Ama",
      last_name: "Mensah",
      phone: "+233 24 412 3456",
      address_line: "12 Ring Road",
      city: "Accra",
      country: "Ghana",
      preferred_contact: "whatsapp",
    });
  });

  it("rejects invalid preferred contact", () => {
    const result = parseCustomerProfileUpdate({ preferredContact: "telegram" });
    expect(result.ok).toBe(false);
  });
});

describe("mergeProfileUpdate", () => {
  const current = {
    first_name: "Ama",
    last_name: "Mensah",
    phone: "0244123456",
    address_line: "Old Street",
    city: "Kumasi",
    country: "Ghana",
    preferred_contact: "email" as const,
  };

  it("updates phone without clearing name or address", () => {
    const result = mergeProfileUpdate(current, { phone: "+233244123456" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next).toEqual({
      first_name: "Ama",
      last_name: "Mensah",
      phone: "+233244123456",
      address_line: "Old Street",
      city: "Kumasi",
      country: "Ghana",
      preferred_contact: "email",
    });
  });

  it("rejects clearing first name when provided", () => {
    const result = mergeProfileUpdate(current, { firstName: "   " });
    expect(result.ok).toBe(false);
  });

  it("can clear preferred contact", () => {
    const result = mergeProfileUpdate(current, { preferredContact: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.next.preferred_contact).toBeNull();
  });
});

describe("customerAvatarUrl", () => {
  it("reads common OAuth avatar keys", () => {
    expect(
      customerAvatarUrl({ picture: "https://lh3.googleusercontent.com/a/photo" })
    ).toBe("https://lh3.googleusercontent.com/a/photo");
    expect(customerAvatarUrl({ avatar_url: "not-a-url" })).toBeNull();
  });
});

describe("resolveCustomerAvatarUrl", () => {
  it("prefers uploaded profile avatar over OAuth picture", () => {
    expect(
      resolveCustomerAvatarUrl({
        profileAvatarUrl: "https://cdn.example.com/me.jpg",
        userMetadata: { picture: "https://lh3.googleusercontent.com/a/photo" },
      })
    ).toBe("https://cdn.example.com/me.jpg");
  });

  it("falls back to OAuth when no uploaded avatar", () => {
    expect(
      resolveCustomerAvatarUrl({
        profileAvatarUrl: null,
        userMetadata: { picture: "https://lh3.googleusercontent.com/a/photo" },
      })
    ).toBe("https://lh3.googleusercontent.com/a/photo");
  });
});

describe("customerAuthProviderLabel", () => {
  it("labels google and email providers", () => {
    expect(customerAuthProviderLabel({ app_metadata: { provider: "google" } })).toBe(
      "Google"
    );
    expect(customerAuthProviderLabel({ identities: [{ provider: "email" }] })).toBe(
      "Email"
    );
  });
});

describe("formatMemberSince", () => {
  it("formats valid dates", () => {
    expect(formatMemberSince("2026-01-15T12:00:00.000Z")).toMatch(/2026/);
  });

  it("returns null for invalid dates", () => {
    expect(formatMemberSince("not-a-date")).toBeNull();
  });
});
