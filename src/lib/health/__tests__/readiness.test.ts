import { describe, expect, it } from "vitest";
import { GET as getLiveness } from "@/app/api/health/live/route";
import { evaluateReadinessChecks } from "@/lib/health/readiness-core";

describe("deployment health endpoints", () => {
  it("keeps liveness cheap and non-cacheable", async () => {
    const response = getLiveness();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(body.status).toBe("ok");
  });

  it("reports ready only when configuration and database checks pass", async () => {
    const ready = await evaluateReadinessChecks({
      configurationReady: () => true,
      databaseReady: async () => true,
      release: () => "release-123",
    });
    const unavailable = await evaluateReadinessChecks({
      configurationReady: () => true,
      databaseReady: async () => false,
      release: () => "release-123",
    });

    expect(ready).toEqual({ ready: true, release: "release-123" });
    expect(unavailable).toEqual({ ready: false, release: "release-123" });
  });

  it("does not call the database when required configuration is missing", async () => {
    let databaseCalled = false;
    const result = await evaluateReadinessChecks({
      configurationReady: () => false,
      databaseReady: async () => {
        databaseCalled = true;
        return true;
      },
      release: () => "unknown",
    });

    expect(result.ready).toBe(false);
    expect(databaseCalled).toBe(false);
  });
});
