import { describe, expect, it } from "vitest";
import {
  applyDismissalsToNotifications,
  isEphemeralAdminNotificationId,
  mergeLoadedNotificationReadState,
} from "@/lib/platform/notification-read-state";
import type { AdminNotification } from "@/lib/platform/types";

function notification(
  id: string,
  readAt: string | null = null
): AdminNotification {
  return {
    id,
    type: "contact",
    title: "Test",
    message: "Test message",
    link: null,
    sourceTable: null,
    sourceId: null,
    readAt,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("admin notification read state", () => {
  it("identifies synthetic notification ids", () => {
    expect(isEphemeralAdminNotificationId("low-stock")).toBe(true);
    expect(isEphemeralAdminNotificationId("notification-log-abc")).toBe(true);
    expect(isEphemeralAdminNotificationId("real-uuid")).toBe(false);
  });

  it("keeps optimistic read state across refetches", () => {
    const previous = [notification("a", "2026-01-02T00:00:00.000Z"), notification("b")];
    const incoming = [notification("a"), notification("b")];

    const merged = mergeLoadedNotificationReadState(previous, incoming);

    expect(merged[0]?.readAt).toBe("2026-01-02T00:00:00.000Z");
    expect(merged[1]?.readAt).toBeNull();
  });

  it("applies persisted dismissals to synthetic notifications", () => {
    const notifications = [
      notification("low-stock"),
      notification("notification-log-1"),
      notification("db-id"),
    ];

    const merged = applyDismissalsToNotifications(
      notifications,
      new Set(["low-stock", "notification-log-1"]),
      "2026-01-03T00:00:00.000Z"
    );

    expect(merged[0]?.readAt).toBe("2026-01-03T00:00:00.000Z");
    expect(merged[1]?.readAt).toBe("2026-01-03T00:00:00.000Z");
    expect(merged[2]?.readAt).toBeNull();
  });
});
