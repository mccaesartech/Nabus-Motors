import { describe, expect, it } from "vitest";
import { buildCustomerMessage } from "@/lib/notifications/templates";

describe("security / price-drop customer templates", () => {
  it("builds price drop email and SMS copy", () => {
    const msg = buildCustomerMessage("price_drop", {
      customerName: "Ama",
      vehicleTitle: "2024 Toyota Camry",
      oldPrice: "28,000",
      newPrice: "25,500",
      vehicleUrl: "https://www.nabusmotors.com/auto/inventory/camry",
    });
    expect(msg.subject).toContain("Price drop");
    expect(msg.emailText).toContain("25,500");
    expect(msg.whatsapp).toContain("Price drop");
  });

  it("builds MFA and password-changed templates", () => {
    expect(buildCustomerMessage("mfa_enabled", { customerName: "Kojo" }).subject).toMatch(
      /Authenticator enabled/i
    );
    expect(buildCustomerMessage("mfa_disabled", {}).subject).toMatch(/removed/i);
    expect(buildCustomerMessage("password_changed", {}).whatsapp).toMatch(/password was changed/i);
  });

  it("builds new-device, login-alert, failed-attempt, and lockout templates", () => {
    const device = buildCustomerMessage("login_new_device", {
      when: "Aug 4, 2026",
      device: "Chrome on Windows (Desktop)",
      ip: "1.2.3.4",
    });
    expect(device.subject).toMatch(/New device/i);
    expect(device.emailText).toContain("1.2.3.4");

    const login = buildCustomerMessage("login_alert", {
      when: "Aug 4, 2026",
      device: "Safari on iOS (Mobile)",
    });
    expect(login.subject).toMatch(/sign-in/i);

    const failed = buildCustomerMessage("login_attempt_failed", {
      when: "Aug 4, 2026",
      device: "Chrome on Windows (Desktop)",
      ip: "5.6.7.8",
    });
    expect(failed.subject).toMatch(/Failed sign-in/i);
    expect(failed.emailText).toContain("5.6.7.8");

    expect(buildCustomerMessage("account_lockout", {}).subject).toMatch(/locked/i);
  });

  it("builds account deletion completed template", () => {
    const msg = buildCustomerMessage("account_deletion_completed", {
      scheduledDeletionDate: "September 1, 2026",
    });
    expect(msg.subject).toMatch(/anonymized/i);
    expect(msg.whatsapp).toContain("September 1, 2026");
  });
});