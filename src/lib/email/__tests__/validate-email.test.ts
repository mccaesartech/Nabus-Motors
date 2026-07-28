import { describe, expect, it } from "vitest";
import {
  extractEmailDomain,
  isDisposableEmailDomain,
  isValidEmailFormat,
  normalizeEmail,
  validateEmailLocal,
} from "@/lib/email/validate-email";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });
});

describe("isValidEmailFormat", () => {
  it("accepts common addresses", () => {
    expect(isValidEmailFormat("buyer@truegoshen.com")).toBe(true);
    expect(isValidEmailFormat("first.last+tag@gmail.com")).toBe(true);
  });

  it("rejects empty and malformed values", () => {
    expect(isValidEmailFormat("")).toBe(false);
    expect(isValidEmailFormat("not-an-email")).toBe(false);
    expect(isValidEmailFormat("@nodomain.com")).toBe(false);
    expect(isValidEmailFormat("user@")).toBe(false);
    expect(isValidEmailFormat("user@localhost")).toBe(false);
    expect(isValidEmailFormat("user@.com")).toBe(false);
    expect(isValidEmailFormat("user@domain")).toBe(false);
    expect(isValidEmailFormat("user..name@example.com")).toBe(false);
  });
});

describe("disposable domains", () => {
  it("blocks known disposable hosts and subdomains", () => {
    expect(isDisposableEmailDomain("mailinator.com")).toBe(true);
    expect(isDisposableEmailDomain("yopmail.com")).toBe(true);
    expect(isDisposableEmailDomain("foo.mailinator.com")).toBe(true);
    expect(isDisposableEmailDomain("gmail.com")).toBe(false);
  });
});

describe("validateEmailLocal", () => {
  it("returns ok for a normal mailbox", () => {
    const result = validateEmailLocal("  Buyer@Gmail.com ");
    expect(result).toMatchObject({
      ok: true,
      code: "ok",
      normalized: "buyer@gmail.com",
      domain: "gmail.com",
    });
  });

  it("rejects disposable addresses with a clear message", () => {
    const result = validateEmailLocal("temp@mailinator.com");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("disposable");
    expect(result.message).toBe("Disposable email addresses aren't allowed.");
  });

  it("rejects invalid format", () => {
    const result = validateEmailLocal("bad@@example.com");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("invalid_format");
    expect(result.message).toBe("Enter a valid email address.");
  });

  it("extracts domain from normalized email", () => {
    expect(extractEmailDomain("a@B.Co.uk")).toBe("b.co.uk");
  });
});
