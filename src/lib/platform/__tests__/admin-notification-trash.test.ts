import { describe, expect, it } from "vitest";
import {
  ephemeralNotificationLogId,
  filterOutTrashedAdminNotifications,
  filterOutTrashedDeliveryNotifications,
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

  it("builds ephemeral notification-log ids", () => {
    expect(ephemeralNotificationLogId("abc-123")).toBe("notification-log-abc-123");
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

  it("filters delivery notifications for trashed sent emails", () => {
    const list = [
      { id: "uuid-keep" },
      { id: "notification-log-sent-1" },
      { id: "notification-log-sent-2" },
    ];
    const filtered = filterOutTrashedDeliveryNotifications(
      list,
      new Set(["sent-1"]),
      new Set(["notification-log-sent-2"])
    );
    expect(filtered.map((n) => n.id)).toEqual(["uuid-keep"]);
  });
});
