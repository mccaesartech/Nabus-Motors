import { describe, expect, it } from "vitest";
import {
  filterOutTrashedAdminNotifications,
  isPersistedAdminNotificationId,
} from "@/lib/platform/admin-notification-trash";

describe("admin notification trash helpers", () => {
  it("detects persisted uuid ids", () => {
    expect(isPersistedAdminNotificationId("a1b2c3d4-e5f6-4789-a012-3456789abcde")).toBe(
      true
    );
    expect(isPersistedAdminNotificationId("low-stock")).toBe(false);
    expect(isPersistedAdminNotificationId("notification-log-1")).toBe(false);
  });

  it("filters trashed notifications from lists", () => {
    const list = [
      { id: "keep" },
      { id: "gone" },
      { id: "notification-log-1" },
    ];
    const filtered = filterOutTrashedAdminNotifications(
      list,
      new Set(["gone", "notification-log-1"])
    );
    expect(filtered.map((n) => n.id)).toEqual(["keep"]);
  });
});
