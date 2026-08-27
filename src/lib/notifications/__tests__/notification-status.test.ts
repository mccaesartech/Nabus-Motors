import { describe, expect, it } from "vitest";
import {
  formatCustomerNotificationFeedback,
  sanitizeNotificationReason,
  type CustomerNotificationPayload,
} from "@/lib/notifications/notification-status";

function base(overrides: Partial<CustomerNotificationPayload> = {}): CustomerNotificationPayload {
  return {
    whatsappSent: false,
    emailSent: false,
    whatsappDeferred: false,
    saveReferenceOnScreen: false,
    channels: [],
    whatsappStatus: "not_attempted",
    emailStatus: "not_attempted",
    phone: "+233244876784",
    ...overrides,
  };
}

describe("formatCustomerNotificationFeedback", () => {
  it("keeps message+email success copy free of SMS routing / provider names", () => {
    const feedback = formatCustomerNotificationFeedback(
      base({
        emailSent: true,
        channels: ["sms", "email"],
        whatsappStatus: "skipped",
        emailStatus: "sent",
      }),
      { savedPrefix: "Message sent" }
    );
    expect(feedback.message).toBe("Message sent. Email sent.");
    expect(feedback.variant).toBe("success");
    expect(feedback.message).not.toMatch(/Arkesel|SMS preferred|Resend|Termii|Twilio/i);
  });

  it("returns Message sent. when SMS delivered and email was not attempted", () => {
    const feedback = formatCustomerNotificationFeedback(
      base({
        channels: ["sms"],
        whatsappStatus: "skipped",
        emailStatus: "skipped",
        emailReason: "Email not sent (no email on file)",
      }),
      { savedPrefix: "Message sent" }
    );
    expect(feedback.message).toBe("Message sent.");
    expect(feedback.variant).toBe("success");
  });

  it("does not surface legacy SMS preferred (Arkesel) reasons", () => {
    const feedback = formatCustomerNotificationFeedback(
      base({
        emailSent: true,
        channels: ["email"],
        whatsappStatus: "skipped",
        whatsappReason: "SMS preferred (Arkesel)",
        emailStatus: "sent",
      }),
      { savedPrefix: "Reply sent" }
    );
    expect(feedback.message).toBe("Reply sent. Email sent.");
    expect(feedback.message).not.toMatch(/Arkesel|SMS preferred/i);
  });
});

describe("sanitizeNotificationReason", () => {
  it("strips provider brand names from UI-facing reasons", () => {
    expect(sanitizeNotificationReason("Arkesel error (402): out of credit")).toBe(
      "SMS could not be delivered — check messaging configuration"
    );
    expect(sanitizeNotificationReason("Resend rejected the send (validation_error)")).toBe(
      "Email could not be delivered — check email configuration"
    );
    expect(sanitizeNotificationReason("Twilio error (400): bad request")).toBe(
      "WhatsApp could not be delivered — check messaging configuration"
    );
  });
});
