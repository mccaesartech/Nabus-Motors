import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ResendSendError, parseResendFromAddress } from "@/lib/email/resend";
import {
  describeResendFailure,
  extractUnverifiedDomain,
  formatEmailFailureHint,
  isResendDomainVerificationError,
} from "@/lib/email/resend-constants";

const SANDBOX_ERROR =
  "You can only send testing emails to your own email address (mccaesartechsolutions@gmail.com). To send emails to other recipients, please verify a domain at resend.com/domains, and change the `from` address to an email using this domain";

describe("parseResendFromAddress", () => {
  it("accepts a bare mailbox", () => {
    expect(parseResendFromAddress("noreply@truegoshengh.com")).toEqual({
      header: "noreply@truegoshengh.com",
      address: "noreply@truegoshengh.com",
      domain: "truegoshengh.com",
    });
  });

  it("accepts the display-name form Resend documents", () => {
    expect(parseResendFromAddress("True Goshen <noreply@truegoshengh.com>")).toEqual({
      header: "True Goshen <noreply@truegoshengh.com>",
      address: "noreply@truegoshengh.com",
      domain: "truegoshengh.com",
    });
  });

  it("strips quoting and surrounding whitespace from the env value", () => {
    expect(parseResendFromAddress('  "noreply@truegoshengh.com" ')?.address).toBe(
      "noreply@truegoshengh.com"
    );
  });

  it("rejects blank and malformed values", () => {
    expect(parseResendFromAddress(undefined)).toBeNull();
    expect(parseResendFromAddress("   ")).toBeNull();
    expect(parseResendFromAddress("not-an-email")).toBeNull();
    expect(parseResendFromAddress("True Goshen <not-an-email>")).toBeNull();
  });
});

describe("Resend domain-verification failures", () => {
  it("recognises the sandbox recipient restriction", () => {
    expect(isResendDomainVerificationError(SANDBOX_ERROR)).toBe(true);
  });

  it("recognises an unverified sending domain", () => {
    expect(
      isResendDomainVerificationError(
        "The truegoshengh.com domain is not verified. Please, add and verify your domain on https://resend.com/domains"
      )
    ).toBe(true);
  });

  it("ignores unrelated failures", () => {
    expect(isResendDomainVerificationError("Rate limit exceeded")).toBe(false);
    expect(isResendDomainVerificationError(null)).toBe(false);
    expect(describeResendFailure("Rate limit exceeded")).toBeNull();
  });

  it("explains the fix instead of echoing the provider text", () => {
    const hint = describeResendFailure(SANDBOX_ERROR);
    expect(hint).toContain("resend.com/domains");
    expect(hint).toContain("RESEND_FROM_EMAIL=noreply@truegoshengh.com");
    expect(formatEmailFailureHint(SANDBOX_ERROR)).toBe(hint);
  });

  it("does not claim a verification problem for unrelated rejections", () => {
    for (const detail of [
      "API key is invalid",
      "Missing `to` field.",
      "Invalid `from` field. The from address must be a valid email address.",
      "Too many requests. You can only make 2 requests per second.",
      "The gmail.com domain is not allowed for this account.",
    ]) {
      expect(isResendDomainVerificationError(detail)).toBe(false);
      expect(describeResendFailure(detail)).toBeNull();
      expect(formatEmailFailureHint(detail)).toBe(detail);
    }
  });

  it("does not re-classify its own hint, so a hint can never mask the cause", () => {
    const hint = describeResendFailure(SANDBOX_ERROR);
    expect(hint).not.toBeNull();
    expect(isResendDomainVerificationError(hint)).toBe(false);
  });

  it("names the domain Resend rejected rather than the assumed one", () => {
    const detail =
      "The truegoshen.com domain is not verified. Please, add and verify your domain on https://resend.com/domains";
    expect(extractUnverifiedDomain(detail)).toBe("truegoshen.com");

    const hint = describeResendFailure(detail);
    expect(hint).toContain("truegoshen.com is not verified");
    expect(hint).toContain("RESEND_FROM_EMAIL=noreply@truegoshen.com");
  });

  it("falls back to the From address we actually sent with", () => {
    const hint = describeResendFailure(SANDBOX_ERROR, {
      fromDomain: "resend.dev",
      fromAddress: "onboarding@resend.dev",
    });
    expect(hint).toContain("onboarding@resend.dev");
    expect(hint).toContain("resend.dev is not verified");
  });

  it("points at an account/team mismatch when the domain is already verified", () => {
    const hint = describeResendFailure(SANDBOX_ERROR);
    expect(hint).toContain("different Resend account or team");
  });
});

describe("ResendSendError", () => {
  const from = {
    header: "True Goshen <noreply@truegoshengh.com>",
    address: "noreply@truegoshengh.com",
    domain: "truegoshengh.com",
  };

  it("keeps the provider code, status and sender in the persisted message", () => {
    const error = new ResendSendError({
      providerMessage: SANDBOX_ERROR,
      providerCode: "validation_error",
      statusCode: 403,
      from,
    });

    expect(error.message).toContain("validation_error");
    expect(error.message).toContain("HTTP 403");
    expect(error.message).toContain("noreply@truegoshengh.com");
    expect(error.message).toContain(SANDBOX_ERROR);
    expect(error.providerMessage).toBe(SANDBOX_ERROR);
    expect(error.fromDomain).toBe("truegoshengh.com");
  });

  it("omits the label when Resend gives no code or status", () => {
    const error = new ResendSendError({ providerMessage: "Boom", from });
    expect(error.message).toBe("Resend rejected the send from noreply@truegoshengh.com: Boom");
  });
});
