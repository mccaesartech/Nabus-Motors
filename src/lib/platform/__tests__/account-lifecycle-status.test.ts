import { describe, expect, it } from "vitest";
import {
  effectiveAccountStatus,
  shouldAppearInLifecycleTab,
} from "@/lib/platform/account-lifecycle-status";

describe("effectiveAccountStatus", () => {
  it("keeps status when not soft-deleted", () => {
    expect(effectiveAccountStatus("active", null)).toBe("active");
    expect(effectiveAccountStatus("pending_deletion", null)).toBe("pending_deletion");
  });

  it("forces deleted when deleted_at is set", () => {
    expect(effectiveAccountStatus("active", "2026-01-01T00:00:00.000Z")).toBe("deleted");
    expect(effectiveAccountStatus("suspended", "2026-01-01T00:00:00.000Z")).toBe("deleted");
  });
});

describe("shouldAppearInLifecycleTab", () => {
  it("hides soft-deleted accounts from Active", () => {
    expect(
      shouldAppearInLifecycleTab("active", "active", "2026-01-01T00:00:00.000Z")
    ).toBe(false);
  });

  it("shows soft-deleted accounts under Archived", () => {
    expect(
      shouldAppearInLifecycleTab("archived", "active", "2026-01-01T00:00:00.000Z")
    ).toBe(true);
  });

  it("shows truly active accounts under Active", () => {
    expect(shouldAppearInLifecycleTab("active", "active", null)).toBe(true);
  });
});
