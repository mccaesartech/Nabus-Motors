import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const logged: Array<Record<string, unknown>> = [];

vi.mock("@/lib/errors/logger", async () => {
  const { AppError } = await import("@/lib/errors/kinds");
  return {
    ERROR_LOG_TABLE: "platform_error_log",
    logAppError: (input: Record<string, unknown>) => {
      logged.push(input);
      return "TG-7K3QP2";
    },
    toAppError: (error: unknown, fallbackMessage?: string) =>
      error instanceof AppError ? error : new AppError("unknown", { message: fallbackMessage, cause: error }),
  };
});

const { apiFailure, dbFailure, externalFailure, withApiErrorHandling } = await import(
  "@/lib/errors/api"
);

beforeEach(() => {
  logged.length = 0;
});

describe("standard API failure shape", () => {
  it("returns ok, success, message and errorId with the mapped status", async () => {
    const response = dbFailure(
      { code: "23505", message: 'duplicate key value violates unique constraint "vehicles_vin_key"' },
      { module: "api.admin.vehicles.POST", message: "We could not save this vehicle." }
    );

    expect(response.status).toBe(409);

    const body = await response.json();
    expect(body).toEqual({
      ok: false,
      success: false,
      message: "Another vehicle already uses this VIN. Leave VIN blank or use a unique value.",
      errorId: "TG-7K3QP2",
    });
  });

  it("never includes the raw error, stack, or db code in the body", async () => {
    const response = dbFailure(
      { code: "42703", message: 'column vehicles.gearbox_kind does not exist' },
      { module: "api.admin.vehicles.PATCH" }
    );

    const serialized = JSON.stringify(await response.json());
    expect(serialized).not.toContain("gearbox_kind");
    expect(serialized).not.toContain("42703");
    expect(serialized).not.toContain("stack");
  });

  it("logs the internal detail even though the response hides it", () => {
    dbFailure({ code: "23503", message: "violates foreign key constraint" }, {
      module: "api.admin.sales.DELETE",
    });

    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ module: "api.admin.sales.DELETE", status: 409 });
  });

  it("maps an unknown throw to a 500 with a generic sentence", async () => {
    const response = apiFailure(new Error("read ECONNRESET"), {
      module: "api.admin.reports.export.GET",
      message: "We could not build that report.",
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.message).toBe("We could not build that report.");
    expect(body.errorId).toBe("TG-7K3QP2");
    expect(JSON.stringify(body)).not.toContain("ECONNRESET");
  });

  it("maps an upstream provider failure to 502", async () => {
    const response = externalFailure(new Error("Resend 429"), {
      module: "api.admin.emails.POST",
      message: "The email service did not respond. Try again shortly.",
    });

    expect(response.status).toBe(502);
    expect((await response.json()).message).toBe(
      "The email service did not respond. Try again shortly."
    );
  });

  it("merges user-safe extras without overwriting the contract fields", async () => {
    const response = apiFailure(new Error("boom"), {
      module: "api.admin.platform-users.POST",
      message: "We could not create that user.",
      extra: { migrationRequired: true },
    });

    const body = await response.json();
    expect(body.migrationRequired).toBe(true);
    expect(body.ok).toBe(false);
    expect(body.success).toBe(false);
  });

  it("converts an unhandled throw inside a wrapped handler into a friendly 500", async () => {
    const handler = withApiErrorHandling<[Request]>("api.test.GET", async () => {
      throw new Error('relation "widgets" does not exist');
    });

    const response = await handler(new Request("https://truegoshen.vercel.app/api/test"));
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.errorId).toBe("TG-7K3QP2");
    expect(JSON.stringify(body)).not.toContain("widgets");
  });
});
