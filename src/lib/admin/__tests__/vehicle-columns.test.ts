import { describe, expect, it } from "vitest";
import {
  adminVehicleSelectColumns,
  isMissingOptionalVehicleColumnError,
  isMissingVehicleColumnError,
  omitEmptyOptionalVehicleFields,
  optionalVehicleColumnWarning,
  stripOptionalVehicleColumns,
  vehicleWriteWithOptionalFallback,
} from "@/lib/admin/vehicle-columns";

describe("isMissingVehicleColumnError", () => {
  it("detects PostgREST schema cache errors", () => {
    expect(
      isMissingVehicleColumnError(
        'Could not find the "walkaround_video_url" column of "vehicles" in the schema cache'
      )
    ).toBe(true);
  });

  it("detects Postgres does-not-exist errors (production)", () => {
    expect(
      isMissingVehicleColumnError("column vehicles.walkaround_video_url does not exist")
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isMissingVehicleColumnError("duplicate key value violates unique constraint")).toBe(
      false
    );
  });
});

describe("isMissingOptionalVehicleColumnError", () => {
  it("matches optional columns only", () => {
    expect(
      isMissingOptionalVehicleColumnError("column vehicles.walkaround_video_url does not exist")
    ).toBe(true);
    expect(
      isMissingOptionalVehicleColumnError("column vehicles.make does not exist")
    ).toBe(false);
  });
});

describe("stripOptionalVehicleColumns", () => {
  it("removes optional columns from update payload", () => {
    const stripped = stripOptionalVehicleColumns({
      make: "Toyota",
      walkaround_video_url: "https://example.com/v.mp4",
      gallery: { exterior: [], interior: [], engine: [], other: [] },
      trust_badges: { verified_by_true_goshen: true },
    });
    expect(stripped).toEqual({ make: "Toyota" });
  });

  it("strips optional fields nested in pending_changes", () => {
    const stripped = stripOptionalVehicleColumns({
      approval_status: "pending_approval",
      pending_changes: {
        price: 12000,
        walkaround_video_url: "https://example.com/v.mp4",
      },
    });
    expect(stripped.pending_changes).toEqual({ price: 12000 });
  });
});

describe("omitEmptyOptionalVehicleFields", () => {
  it("normalizes empty optional strings to null so PATCH can clear them", () => {
    const next = omitEmptyOptionalVehicleFields({
      make: "Honda",
      walkaround_video_url: "  ",
      warranty_notes: "",
      price: 9000,
    });
    expect(next).toEqual({
      make: "Honda",
      walkaround_video_url: null,
      warranty_notes: null,
      price: 9000,
    });
  });
});

describe("adminVehicleSelectColumns", () => {
  it("excludes optional columns in safe mode", () => {
    const safe = adminVehicleSelectColumns("safe");
    expect(safe).not.toContain("walkaround_video_url");
    expect(safe).not.toContain("gallery");
    expect(safe).toContain("make");
    expect(safe).toContain("approval_status");
  });
});

describe("optionalVehicleColumnWarning", () => {
  it("mentions migration file for walkaround", () => {
    const msg = optionalVehicleColumnWarning(
      "column vehicles.walkaround_video_url does not exist"
    );
    expect(msg).toContain("065_vehicle_walkaround_video.sql");
    expect(msg).toContain("Saved without optional fields");
  });
});

describe("vehicleWriteWithOptionalFallback", () => {
  it("does not retry with an empty payload when only optional columns were written", async () => {
    const missing =
      'Could not find the "stock_quantity" column of "vehicles" in the schema cache';
    const writes: Array<Record<string, unknown>> = [];
    const result = await vehicleWriteWithOptionalFallback(async (_select, payload) => {
      writes.push(payload);
      return { data: null, error: { message: missing } };
    }, { stock_quantity: 3 });

    expect(writes).toHaveLength(1);
    expect(result.result.error?.message).toContain("stock_quantity");
    expect(result.warning).toContain("082_vehicle_stock_quantity.sql");
  });

  it("retries with stripped optional columns when core fields remain", async () => {
    const missing =
      'Could not find the "stock_quantity" column of "vehicles" in the schema cache';
    const writes: Array<Record<string, unknown>> = [];
    const result = await vehicleWriteWithOptionalFallback(async (_select, payload) => {
      writes.push(payload);
      if (payload.stock_quantity !== undefined) {
        return { data: null, error: { message: missing } };
      }
      return { data: { id: "1", status: "sold" } as { id: string; status: string }, error: null };
    }, { status: "sold", stock_quantity: 0 });

    expect(writes).toHaveLength(2);
    expect(writes[1]).toEqual({ status: "sold" });
    expect(result.result.data).toEqual({ id: "1", status: "sold" });
  });
});
