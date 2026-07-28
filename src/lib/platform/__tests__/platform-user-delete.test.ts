import { describe, expect, it } from "vitest";
import { assertPlatformUserDeletable } from "@/lib/platform/platform-user-delete";

describe("assertPlatformUserDeletable", () => {
  it("blocks owner accounts", () => {
    const result = assertPlatformUserDeletable({
      id: "owner-1",
      role: "owner",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.message).toMatch(/owner/i);
    }
  });

  it("blocks already-trashed users", () => {
    const result = assertPlatformUserDeletable({
      id: "u-1",
      role: "staff",
      deleted_at: "2026-01-01T00:00:00.000Z",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("blocks self-delete", () => {
    const result = assertPlatformUserDeletable(
      { id: "u-1", role: "manager" },
      "u-1"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.message).toMatch(/own account/i);
    }
  });

  it("allows deleting another non-owner user", () => {
    const result = assertPlatformUserDeletable(
      { id: "u-2", role: "staff", deleted_at: null },
      "u-1"
    );
    expect(result).toEqual({ ok: true });
  });
});
