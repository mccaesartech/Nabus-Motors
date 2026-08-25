import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
import { redactAuditMetadata, AUDIT_REDACTED } from "@/lib/audit/redact";
import { canViewAuditLog, roleCanViewAuditLog } from "@/lib/audit/access";
import type { PlatformAuthContext } from "@/lib/admin/auth";

describe("redactAuditMetadata", () => {
  it("redacts password, token, and api key fields", () => {
    const out = redactAuditMetadata({
      password: "super-secret",
      access_token: "tok_abc",
      apiKey: "key_123",
      vehicleId: "v1",
      nested: { refresh_token: "r", ok: true },
    });

    expect(out.password).toBe(AUDIT_REDACTED);
    expect(out.access_token).toBe(AUDIT_REDACTED);
    expect(out.apiKey).toBe(AUDIT_REDACTED);
    expect(out.vehicleId).toBe("v1");
    expect((out.nested as Record<string, unknown>).refresh_token).toBe(AUDIT_REDACTED);
    expect((out.nested as Record<string, unknown>).ok).toBe(true);
  });

  it("returns empty object for invalid input", () => {
    expect(redactAuditMetadata(null)).toEqual({});
    expect(redactAuditMetadata(undefined)).toEqual({});
  });
});

describe("canViewAuditLog / roleCanViewAuditLog", () => {
  const base = (role: PlatformAuthContext["role"], type: PlatformAuthContext["type"] = "user"): PlatformAuthContext => ({
    type,
    name: "Test",
    email: "t@example.com",
    role,
    userId: type === "user" ? "u1" : undefined,
  });

  it("allows owner bootstrap, owner role, and super_admin", () => {
    expect(canViewAuditLog(base("owner", "owner"))).toBe(true);
    expect(canViewAuditLog(base("owner"))).toBe(true);
    expect(canViewAuditLog(base("super_admin"))).toBe(true);
  });

  it("denies manager and staff", () => {
    expect(canViewAuditLog(base("manager"))).toBe(false);
    expect(canViewAuditLog(base("staff"))).toBe(false);
    expect(roleCanViewAuditLog("manager")).toBe(false);
    expect(roleCanViewAuditLog("staff")).toBe(false);
    expect(roleCanViewAuditLog("owner")).toBe(true);
    expect(roleCanViewAuditLog("super_admin")).toBe(true);
  });
});

describe("writeAuditLog", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("never throws when supabase is unavailable", async () => {
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminSupabase: () => null,
    }));
    const { writeAuditLog } = await import("@/lib/audit/write");
    await expect(
      writeAuditLog({ action: "login", success: true, metadata: { password: "x" } })
    ).resolves.toBeUndefined();
  });

  it("inserts a redacted row via admin supabase", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminSupabase: () => ({ from }),
    }));
    vi.doMock("@/lib/observability/schema-capability", () => ({
      SCHEMA_CAPS: { auditLogs: "audit_logs" },
      isMissingRelationError: () => false,
      isSchemaMissing: () => false,
      markSchemaMissing: () => undefined,
      markSchemaPresent: () => undefined,
    }));

    const { writeAuditLog } = await import("@/lib/audit/write");
    await writeAuditLog({
      action: "login",
      success: true,
      actorName: "Owner",
      actorRole: "owner",
      metadata: { password: "secret", note: "ok" },
    });

    expect(from).toHaveBeenCalledWith("audit_logs");
    expect(insert).toHaveBeenCalled();
    const row = insert.mock.calls[0][0];
    expect(row.metadata.password).toBe(AUDIT_REDACTED);
    expect(row.metadata.note).toBe("ok");
    expect(row.action).toBe("login");
    expect(row.success).toBe(true);
  });
});
