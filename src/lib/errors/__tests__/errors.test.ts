import { describe, expect, it } from "vitest";
import { mapDatabaseError } from "@/lib/errors/db-errors";
import {
  ERROR_ID_PATTERN,
  isErrorId,
  newErrorId,
  normalizeErrorId,
} from "@/lib/errors/error-id";
import { errorLogToCsv, type PlatformErrorLogRow } from "@/lib/errors/error-log";
import { AppError, severityForKind, statusForKind } from "@/lib/errors/kinds";
import {
  describeUserAgent,
  maskEmail,
  maskPhone,
  sanitizeHeaders,
  sanitizeRequestBody,
  sanitizeUrl,
} from "@/lib/errors/sanitize";
import { describeApiFailure, friendlyErrorMessage } from "@/lib/errors/client";

describe("error IDs", () => {
  it("generates support-readable TG- references", () => {
    const id = newErrorId();
    expect(id).toMatch(ERROR_ID_PATTERN);
    expect(isErrorId(id)).toBe(true);
  });

  it("never emits the ambiguous I, L, O or U characters", () => {
    const body = Array.from({ length: 200 }, () => newErrorId().slice(3)).join("");
    expect(body).not.toMatch(/[ILOU]/);
  });

  it("produces distinct references", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newErrorId()));
    expect(ids.size).toBe(500);
  });

  it("normalizes what a customer types into a support chat", () => {
    expect(normalizeErrorId(" tg-7k3qp2 ")).toBe("TG-7K3QP2");
    expect(normalizeErrorId("7K3QP2")).toBe("TG-7K3QP2");
  });

  it("rejects values that are not references", () => {
    expect(isErrorId("TG-ILOU12")).toBe(false);
    expect(isErrorId("hello")).toBe(false);
    expect(isErrorId(null)).toBe(false);
  });
});

describe("database error mapping", () => {
  it("maps a unique violation to a conflict, not a Postgres string", () => {
    const mapped = mapDatabaseError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "vehicles_vin_key"',
    });
    expect(mapped.kind).toBe("conflict");
    expect(mapped.message).not.toMatch(/duplicate key|constraint|23505/i);
  });

  it("explains the local/shipment exclusivity constraint in business language", () => {
    const mapped = mapDatabaseError({
      code: "23514",
      message:
        'new row for relation "vehicles" violates check constraint "vehicles_local_shipment_exclusive"',
    });
    expect(mapped.kind).toBe("conflict");
    expect(mapped.message.toLowerCase()).toContain("shipment");
    expect(mapped.message).not.toContain("vehicles_local_shipment_exclusive");
  });

  it("maps a foreign key violation without naming the table", () => {
    const mapped = mapDatabaseError({
      code: "23503",
      message: 'insert or update on table "sales" violates foreign key constraint "sales_vehicle_id_fkey"',
    });
    expect(mapped.kind).toBe("conflict");
    expect(mapped.message).not.toMatch(/fkey|violates/i);
  });

  it("maps PGRST116 to a not-found", () => {
    expect(mapDatabaseError({ code: "PGRST116", message: "0 rows" }).kind).toBe("not_found");
  });

  it("maps a missing table to unavailable rather than leaking the schema", () => {
    const mapped = mapDatabaseError({
      code: "42P01",
      message: 'relation "platform_error_log" does not exist',
    });
    expect(mapped.kind).toBe("unavailable");
    expect(mapped.message).not.toContain("platform_error_log");
  });

  it("falls back to the caller's domain sentence for unknown codes", () => {
    const mapped = mapDatabaseError(
      { code: "XX999", message: "internal error: page corrupted" },
      "We could not save this vehicle."
    );
    expect(mapped.message).toBe("We could not save this vehicle.");
    expect(mapped.message).not.toContain("corrupted");
  });

  it("returns a database AppError whose user message hides the cause", () => {
    const error = new AppError("database", {
      cause: { code: "08006", message: "could not connect to server at 10.0.0.4" },
    });
    expect(error.status).toBe(statusForKind("database"));
    expect(error.userMessage).not.toContain("10.0.0.4");
    expect(severityForKind("database")).toBe("high");
  });
});

describe("redaction", () => {
  it("masks emails and phone numbers", () => {
    expect(maskEmail("owner@nabusmotors.com")).toBe("o***@nabusmotors.com");
    expect(maskPhone("+233 24 123 4567")).toBe("***567");
  });

  it("removes credentials from a request body", () => {
    const body = sanitizeRequestBody({
      email: "buyer@example.com",
      password: "hunter2",
      accessToken: "eyJhbGciOi",
      sessionCookie: "abc",
      vehicleId: "veh_123",
      price: 45000,
      isPublished: true,
    });

    expect(body).toMatchObject({
      email: "b***@example.com",
      password: "[redacted]",
      accessToken: "[redacted]",
      sessionCookie: "[redacted]",
      vehicleId: "veh_123",
      price: 45000,
      isPublished: true,
    });
    expect(JSON.stringify(body)).not.toContain("hunter2");
    expect(JSON.stringify(body)).not.toContain("eyJhbGciOi");
  });

  it("records the size of free text instead of its content", () => {
    const body = sanitizeRequestBody({ message: "Customer complained about the gearbox" });
    expect(body?.message).toBe("[text:37]");
  });

  it("returns null for non-object bodies", () => {
    expect(sanitizeRequestBody(null)).toBeNull();
    expect(sanitizeRequestBody("raw")).toBeNull();
    expect(sanitizeRequestBody([1, 2])).toBeNull();
  });

  it("keeps query parameter names but redacts secret values", () => {
    const url = sanitizeUrl("https://nabus-motors.vercel.app/api/admin/vehicles?token=abc123&page=2");
    expect(url).toBe("/api/admin/vehicles?token=%5Bredacted%5D&page=2");
  });

  it("never logs cookie or authorization headers", () => {
    const headers = new Headers({
      cookie: "tg_platform=secret",
      authorization: "Bearer secret",
      "content-type": "application/json",
    });
    const logged = sanitizeHeaders(headers);
    expect(logged).toEqual({ "content-type": "application/json" });
  });

  it("describes the client coarsely", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
      )
    ).toEqual({ browser: "Chrome", os: "Windows" });
    expect(describeUserAgent(null)).toEqual({ browser: "unknown", os: "unknown" });
  });
});

describe("client-side failure formatting", () => {
  it("surfaces the friendly message and reference from the standard shape", () => {
    const result = describeApiFailure({
      ok: false,
      success: false,
      message: "We could not save this vehicle.",
      errorId: "TG-7K3QP2",
    });
    expect(result.message).toBe("We could not save this vehicle.");
    expect(result.errorId).toBe("TG-7K3QP2");
    expect(result.display).toBe("We could not save this vehicle. (Reference TG-7K3QP2)");
  });

  it("suppresses a raw server string that slipped through", () => {
    const result = describeApiFailure({
      ok: false,
      message: 'duplicate key value violates unique constraint "vehicles_vin_key"',
    });
    expect(result.message).not.toContain("unique constraint");
  });

  it("explains a lost connection instead of showing 'Failed to fetch'", () => {
    const message = friendlyErrorMessage(new TypeError("Failed to fetch"));
    expect(message).not.toContain("Failed to fetch");
    expect(message.toLowerCase()).toContain("connect");
  });
});

describe("error log CSV export", () => {
  const row = {
    id: "1",
    error_id: "TG-7K3QP2",
    severity: "high",
    kind: "database",
    status: 500,
    module: "api.admin.vehicles.PATCH",
    method: "PATCH",
    route: "/api/admin/vehicles",
    user_message: 'We could not save this vehicle, "sorry"',
    internal_message: "=cmd|calc",
    db_code: "23505",
    actor_id: null,
    actor_role: "owner",
    ip: null,
    browser: "Chrome",
    os: "Windows",
    environment: "production",
    release: "abc123",
    stack: null,
    request_body: null,
    context: null,
    resolved_at: null,
    resolved_by_user_id: null,
    resolution_note: null,
    created_at: "2026-07-28T10:00:00.000Z",
  } as PlatformErrorLogRow;

  it("escapes quotes and neutralizes formula injection", () => {
    const csv = errorLogToCsv([row]);
    const [header, line] = csv.split("\n");
    expect(header.startsWith("error_id,created_at,severity")).toBe(true);
    expect(line).toContain('""sorry""');
    expect(line).toContain("\"'=cmd|calc\"");
  });
});
