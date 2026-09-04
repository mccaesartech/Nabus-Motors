import { describe, expect, it } from "vitest";
import { ownerInviteDeliveryError } from "@/lib/platform/invite-delivery-messages";

describe("ownerInviteDeliveryError", () => {
  it("returns null when email and notify both succeeded", () => {
    expect(ownerInviteDeliveryError({ emailSent: true })).toBeNull();
    expect(ownerInviteDeliveryError({ emailSent: true, notifyFailed: false })).toBeNull();
  });

  it("names email-only failures", () => {
    expect(ownerInviteDeliveryError({ emailSent: false })).toBe(
      "The email could not be sent."
    );
  });

  it("appends a safe email hint after the short failure sentence", () => {
    expect(
      ownerInviteDeliveryError({
        emailSent: false,
        emailHint: "Verify nabusmotors.com at resend.com/domains.",
      })
    ).toBe(
      "The email could not be sent. Verify nabusmotors.com at resend.com/domains."
    );
  });

  it("names SMS-only failures", () => {
    expect(ownerInviteDeliveryError({ emailSent: true, notifyFailed: true })).toBe(
      "The SMS could not be sent."
    );
  });

  it("names combined failures", () => {
    expect(ownerInviteDeliveryError({ emailSent: false, notifyFailed: true })).toBe(
      "The email and SMS could not be sent."
    );
  });
});