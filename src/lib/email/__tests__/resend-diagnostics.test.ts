import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildResendDiagnostics,
  maskResendApiKey,
  type ResendDomainListResult,
  type ResendDomainRecord,
} from "@/lib/email/resend-diagnostics";

const FROM = "Nabus Motors <noreply@nabusmotors.com>";
const API_KEY = "re_TestKey000000000000000000009Xy4";
const PRODUCTION = { vercelEnv: "production", commitSha: "abc1234" };

function verified(overrides: Partial<ResendDomainRecord> = {}): ResendDomainRecord {
  return {
    name: "nabusmotors.com",
    status: "verified",
    region: "eu-west-1",
    capabilities: { sending: "enabled" },
    ...overrides,
  };
}

function listed(...domains: ResendDomainRecord[]): ResendDomainListResult {
  return { ok: true, domains };
}

describe("maskResendApiKey", () => {
  it("exposes only the last four characters", () => {
    expect(maskResendApiKey(API_KEY)).toBe("9Xy4");
  });

  it("refuses to mask values short enough to guess whole", () => {
    expect(maskResendApiKey("re_abc")).toBeNull();
    expect(maskResendApiKey("")).toBeNull();
    expect(maskResendApiKey(undefined)).toBeNull();
  });
});

describe("buildResendDiagnostics", () => {
  it("never echoes the API key anywhere in the report", () => {
    const report = buildResendDiagnostics({
      apiKey: API_KEY,
      fromEmail: FROM,
      domainList: listed(verified()),
      environment: PRODUCTION,
    });

    expect(JSON.stringify(report)).not.toContain(API_KEY);
    expect(JSON.stringify(report)).not.toContain("re_TestKey");
    expect(report.apiKeyLast4).toBe("9Xy4");
  });

  it("passes when the key can see the From domain as verified", () => {
    const report = buildResendDiagnostics({
      apiKey: API_KEY,
      fromEmail: FROM,
      domainList: listed(verified()),
      environment: PRODUCTION,
    });

    expect(report.status).toBe("ok");
    expect(report.fromDomainVerified).toBe(true);
    expect(report.fromAddress).toBe("noreply@nabusmotors.com");
    expect(report.fromDomain).toBe("nabusmotors.com");
    expect(report.domainCount).toBe(1);
    expect(report.verdict).toContain("eu-west-1");
    expect(report.verdict).toContain("production");
  });

  it("identifies a key scoped to a different Resend team", () => {
    const report = buildResendDiagnostics({
      apiKey: API_KEY,
      fromEmail: FROM,
      domainList: listed(verified({ name: "mccaesartech.com" })),
      environment: PRODUCTION,
    });

    expect(report.status).toBe("from_domain_not_in_account");
    expect(report.fromDomainVerified).toBe(false);
    expect(report.verdict).toContain("does not contain nabusmotors.com");
    expect(report.verdict).toContain("mccaesartech.com");
    expect(report.nextAction).toContain("last four characters must change");
  });

  it("explains an empty domain list rather than implying the domain exists", () => {
    const report = buildResendDiagnostics({
      apiKey: API_KEY,
      fromEmail: FROM,
      domainList: listed(),
      environment: PRODUCTION,
    });

    expect(report.status).toBe("from_domain_not_in_account");
    expect(report.domainCount).toBe(0);
    expect(report.verdict).toContain("no domains at all");
  });

  it("separates a present-but-unverified domain from a missing one", () => {
    const report = buildResendDiagnostics({
      apiKey: API_KEY,
      fromEmail: FROM,
      domainList: listed(verified({ status: "pending" })),
      environment: PRODUCTION,
    });

    expect(report.status).toBe("from_domain_unverified");
    expect(report.verdict).toContain('status is "pending"');
  });

  it("flags a verified domain whose sending capability is off", () => {
    const report = buildResendDiagnostics({
      apiKey: API_KEY,
      fromEmail: FROM,
      domainList: listed(verified({ capabilities: { sending: "disabled" } })),
      environment: PRODUCTION,
    });

    expect(report.status).toBe("from_domain_unverified");
    expect(report.fromDomainVerified).toBe(true);
    expect(report.verdict).toContain("sending capability is disabled");
  });

  it("matches the domain case-insensitively", () => {
    const report = buildResendDiagnostics({
      apiKey: API_KEY,
      fromEmail: "noreply@nabusmotors.com",
      domainList: listed(verified({ name: "nabusmotors.com" })),
      environment: PRODUCTION,
    });

    expect(report.status).toBe("ok");
  });

  it("reports a sending-only key as valid but unable to prove team ownership", () => {
    const report = buildResendDiagnostics({
      apiKey: API_KEY,
      fromEmail: FROM,
      domainList: {
        ok: false,
        message: "This API key is restricted to only send emails.",
        code: "restricted_api_key",
        statusCode: 401,
      },
      environment: PRODUCTION,
    });

    expect(report.status).toBe("key_restricted");
    expect(report.fromDomainVerified).toBeNull();
    expect(report.providerError?.statusCode).toBe(401);
    expect(report.nextAction).toContain("Full access");
  });

  it("reports a rejected key distinctly from a team mismatch", () => {
    const report = buildResendDiagnostics({
      apiKey: API_KEY,
      fromEmail: FROM,
      domainList: {
        ok: false,
        message: "API key is invalid",
        code: "invalid_api_key",
        statusCode: 403,
      },
      environment: PRODUCTION,
    });

    expect(report.status).toBe("key_rejected");
    expect(report.verdict).toContain("rejected");
  });

  it("does not blame the key for an unrelated provider failure", () => {
    const report = buildResendDiagnostics({
      apiKey: API_KEY,
      fromEmail: FROM,
      domainList: {
        ok: false,
        message: "An unexpected error occurred.",
        code: "internal_server_error",
        statusCode: 500,
      },
      environment: PRODUCTION,
    });

    expect(report.status).toBe("provider_unreachable");
    expect(report.nextAction).toContain("resend-status.com");
  });

  it("names the environment whose key is missing, because Vercel scopes them separately", () => {
    const report = buildResendDiagnostics({
      apiKey: null,
      fromEmail: FROM,
      domainList: null,
      environment: PRODUCTION,
    });

    expect(report.status).toBe("not_configured");
    expect(report.apiKeyConfigured).toBe(false);
    expect(report.apiKeyLast4).toBeNull();
    expect(report.nextAction).toContain("production environment ticked");
  });

  it("rejects a malformed sender before calling the provider", () => {
    const report = buildResendDiagnostics({
      apiKey: API_KEY,
      fromEmail: "not-an-email",
      domainList: null,
      environment: PRODUCTION,
    });

    expect(report.status).toBe("from_address_invalid");
    expect(report.nextAction).toContain("RESEND_FROM_EMAIL");
  });

  it("falls back to a local label when Vercel env vars are absent", () => {
    const report = buildResendDiagnostics({
      apiKey: null,
      fromEmail: FROM,
      domainList: null,
    });

    expect(report.environment.vercelEnv).toBeNull();
    expect(report.verdict).toContain("local environment");
  });

  it("states that an EU region needs no extra configuration", () => {
    const report = buildResendDiagnostics({
      apiKey: API_KEY,
      fromEmail: FROM,
      domainList: listed(verified()),
      environment: PRODUCTION,
    });

    expect(report.regionNote).toContain("api.resend.com");
    expect(report.regionNote).toContain("not region-scoped");
  });
});
