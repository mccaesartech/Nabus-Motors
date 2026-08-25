import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { welcomeEmail } from "@/lib/email/branded-templates";

describe("welcomeEmail", () => {
  it("confirms account creation and includes tracking identifiers", () => {
    const mail = welcomeEmail("Ama Mensah", "https://www.truegoshengh.com/account", {
      registrationId: "TG-2026-00042",
      customerId: "11111111-2222-3333-4444-555555555555",
      supportEmail: "info@truegoshenauto.com",
      supportPhone: "+233 24 487 6784",
    });

    expect(mail.subject).toMatch(/Welcome to True Goshen/i);
    expect(mail.text).toContain("Your account has been created");
    expect(mail.text).toContain("Account reference: TG-2026-00042");
    expect(mail.text).toContain("Customer ID: 11111111-2222-3333-4444-555555555555");
    expect(mail.text).toContain("Support email: info@truegoshenauto.com");
    expect(mail.text).toContain("Support phone: +233 24 487 6784");
    expect(mail.text).toContain("https://www.truegoshengh.com/account");

    expect(mail.html).toContain("Account reference:");
    expect(mail.html).toContain("TG-2026-00042");
    expect(mail.html).toContain("Customer ID:");
    expect(mail.html).toContain("Open my account");
  });

  it("escapes customer name in HTML", () => {
    const mail = welcomeEmail("Ama <b>x</b>", "https://www.truegoshengh.com/account");
    expect(mail.html).toContain("Ama &lt;b&gt;x&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>x</b>");
  });
});