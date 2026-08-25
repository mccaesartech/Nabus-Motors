import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  STAFF_ORDER_NOTIFY_TEMPLATE,
  staffOrderNotifyIdempotencyKey,
} from "@/lib/platform/staff-order-notify";
import { buildCartOrderStaffContent } from "@/lib/platform/vehicle-sale-notifications";

describe("staff order notify idempotency", () => {
  it("builds one key per source order", () => {
    const key = staffOrderNotifyIdempotencyKey("parts_orders", "order-123");
    expect(key).toBe(`${STAFF_ORDER_NOTIFY_TEMPLATE}:parts_orders:order-123`);
  });
});

describe("cart order staff content", () => {
  it("labels parts-only orders as cart orders", () => {
    const content = buildCartOrderStaffContent({
      orderId: "00000000-0000-4000-8000-000000000001",
      customerName: "Ama",
      customerEmail: "ama@example.com",
      customerPhone: "+233200000000",
      totalUsd: 120,
      items: [{ label: "Brake pads", itemType: "part", quantity: 2 }],
    });

    expect(content.notificationType).toBe("order");
    expect(content.title).toContain("parts order");
    expect(content.message).toContain("Please attend");
  });
});
