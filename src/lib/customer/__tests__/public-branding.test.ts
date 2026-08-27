import { describe, expect, it } from "vitest";
import {
  customerFacingStaffReplyTitle,
  sanitizeCustomerNotificationTitle,
} from "@/lib/customer/public-branding";

describe("customer public branding", () => {
  it("uses Reply from True Goshen for staff reply titles", () => {
    expect(customerFacingStaffReplyTitle()).toBe("Reply from True Goshen");
  });

  it("sanitizes role-leaking Reply from titles", () => {
    expect(sanitizeCustomerNotificationTitle("Reply from Owner")).toBe(
      "Reply from True Goshen"
    );
    expect(sanitizeCustomerNotificationTitle("Reply from Manager")).toBe(
      "Reply from True Goshen"
    );
    expect(sanitizeCustomerNotificationTitle("Reply from Staff")).toBe(
      "Reply from True Goshen"
    );
    expect(sanitizeCustomerNotificationTitle("Reply from Jane")).toBe(
      "Reply from True Goshen"
    );
  });

  it("leaves unrelated notification titles alone", () => {
    expect(sanitizeCustomerNotificationTitle("Order confirmed")).toBe(
      "Order confirmed"
    );
  });
});
