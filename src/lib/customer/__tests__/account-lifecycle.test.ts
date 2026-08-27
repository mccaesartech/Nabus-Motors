import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => null }));
vi.mock("@/lib/email/resend", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/notifications/customer-notify", () => ({ notifyCustomer: vi.fn() }));

import { isValidDeleteConfirmation } from "@/lib/customer/account-lifecycle.validation";
import { DELETION_REASONS } from "@/lib/customer/account-lifecycle.shared";
import { isValidDeletionReason } from "@/lib/customer/account-lifecycle.validation";
import {
  computeCustomerReauthExpiresAt,
  CUSTOMER_REAUTH_CODE_TTL_MS,
  generateCustomerReauthCode,
  isCustomerReauthCodeExpired,
} from "@/lib/customer/account-lifecycle";

describe("account deletion confirmation", () => {
  it("accepts DELETE keyword", () => {
    expect(isValidDeleteConfirmation("DELETE", "user@example.com")).toBe(true);
  });

  it("accepts matching email case-insensitively", () => {
    expect(isValidDeleteConfirmation("User@Example.com", "user@example.com")).toBe(true);
  });

  it("rejects mismatched confirmation", () => {
    expect(isValidDeleteConfirmation("wrong", "user@example.com")).toBe(false);
  });
});

describe("deletion reasons", () => {
  it("validates known reasons", () => {
    for (const reason of DELETION_REASONS) {
      expect(isValidDeletionReason(reason)).toBe(true);
    }
    expect(isValidDeletionReason("unknown")).toBe(false);
  });
});

describe("customer reauth code helpers", () => {
  it("generates a 6-digit zero-padded code", () => {
    const code = generateCustomerReauthCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("computes a 15-minute expiry", () => {
    const now = Date.parse("2026-08-04T12:00:00.000Z");
    const expiresAt = computeCustomerReauthExpiresAt(now);
    expect(Date.parse(expiresAt) - now).toBe(CUSTOMER_REAUTH_CODE_TTL_MS);
    expect(isCustomerReauthCodeExpired(expiresAt, now)).toBe(false);
    expect(isCustomerReauthCodeExpired(expiresAt, now + CUSTOMER_REAUTH_CODE_TTL_MS + 1)).toBe(
      true
    );
  });
});
