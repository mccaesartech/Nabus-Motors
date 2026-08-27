import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isSchemaCacheStaleError,
  isSchemaMissing,
  markSchemaMissing,
  markSchemaPresent,
  SCHEMA_CACHE_STALE_TTL_MS,
} from "@/lib/observability/schema-capability";

describe("schema-capability TTL", () => {
  afterEach(() => {
    markSchemaPresent("test.cap");
    vi.useRealTimers();
  });

  it("expires sticky missing marks so schema-cache lag can recover", () => {
    vi.useFakeTimers();
    markSchemaMissing("test.cap", 1_000);
    expect(isSchemaMissing("test.cap")).toBe(true);
    vi.advanceTimersByTime(1_001);
    expect(isSchemaMissing("test.cap")).toBe(false);
  });

  it("detects PostgREST schema-cache wording", () => {
    expect(
      isSchemaCacheStaleError(
        "Could not find the table 'public.customer_reauth_codes' in the schema cache"
      )
    ).toBe(true);
    expect(isSchemaCacheStaleError("permission denied for table x")).toBe(false);
    expect(SCHEMA_CACHE_STALE_TTL_MS).toBeLessThan(60_000);
  });
});