import { describe, expect, it } from "vitest";
import { isValidDeleteConfirmation } from "@/lib/customer/account-lifecycle.validation";
import {
  DELETION_REASONS,
  getAccountRetentionDaysClient,
} from "@/lib/customer/account-lifecycle.shared";
import { isValidDeletionReason } from "@/lib/customer/account-lifecycle.validation";

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

describe("retention days", () => {
  it("defaults to 30 days", () => {
    expect(getAccountRetentionDaysClient()).toBe(30);
  });
});
