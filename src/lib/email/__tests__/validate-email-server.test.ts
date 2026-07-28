import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const resolveMx = vi.fn();

vi.mock("node:dns", () => ({
  promises: {
    resolveMx: (...args: unknown[]) => resolveMx(...args),
  },
}));

describe("validateEmailForSignup", () => {
  beforeEach(() => {
    resolveMx.mockReset();
  });

  it("rejects disposable domains before MX lookup", async () => {
    const { validateEmailForSignup } = await import(
      "@/lib/email/validate-email-server"
    );
    const result = await validateEmailForSignup("x@mailinator.com");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("disposable");
    expect(resolveMx).not.toHaveBeenCalled();
  });

  it("rejects domains with no MX records", async () => {
    resolveMx.mockRejectedValueOnce(
      Object.assign(new Error("queryMx ENODATA"), { code: "ENODATA" })
    );
    const { validateEmailForSignup } = await import(
      "@/lib/email/validate-email-server"
    );
    const result = await validateEmailForSignup("user@this-domain-has-no-mx.invalid");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("no_mx");
    expect(result.message).toBe("This email domain looks invalid.");
  });

  it("accepts domains that return MX records", async () => {
    resolveMx.mockResolvedValueOnce([{ exchange: "aspmx.l.google.com", priority: 1 }]);
    const { validateEmailForSignup } = await import(
      "@/lib/email/validate-email-server"
    );
    const result = await validateEmailForSignup("buyer@gmail.com");
    expect(result).toMatchObject({
      ok: true,
      code: "ok",
      normalized: "buyer@gmail.com",
      domain: "gmail.com",
    });
  });

  it("can skip MX when checkMx is false", async () => {
    const { validateEmailForSignup } = await import(
      "@/lib/email/validate-email-server"
    );
    const result = await validateEmailForSignup("buyer@example.com", {
      checkMx: false,
    });
    expect(result.ok).toBe(true);
    expect(resolveMx).not.toHaveBeenCalled();
  });
});
