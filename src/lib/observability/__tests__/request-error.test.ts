import { describe, expect, it } from "vitest";
import { buildRequestErrorRecord } from "@/lib/observability/request-error";

describe("structured request error logging", () => {
  it("records operational dimensions without request URLs, headers, or messages", () => {
    const sensitiveValue = "person@example.com";
    const record = buildRequestErrorRecord({
      digest: "digest-123",
      method: "POST",
      routePath: "/api/customer/messages/route",
      routeType: "route",
      runtime: "nodejs",
      environment: "production",
      release: "commit-abc",
    });

    expect(record).toEqual({
      event: "next_request_error",
      digest: "digest-123",
      method: "POST",
      route: "/api/customer/messages/route",
      routeType: "route",
      runtime: "nodejs",
      environment: "production",
      release: "commit-abc",
    });
    expect(JSON.stringify(record)).not.toContain(sensitiveValue);
    expect(record).not.toHaveProperty("headers");
    expect(record).not.toHaveProperty("path");
    expect(record).not.toHaveProperty("message");
  });
});
