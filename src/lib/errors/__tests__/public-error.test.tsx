import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "@/app/error";
import GlobalError from "@/app/global-error";
import { publicErrorReference } from "@/lib/errors/public-error";

describe("public error disclosure", () => {
  it("never renders raw exception messages in route or global boundaries", () => {
    const secret = "SUPABASE_SERVICE_ROLE_KEY=do-not-disclose";
    const error = Object.assign(new Error(secret), { digest: "safe-digest-123" });

    const routeHtml = renderToStaticMarkup(
      <ErrorPage error={error} reset={vi.fn()} />
    );
    const globalHtml = renderToStaticMarkup(
      <GlobalError error={error} reset={vi.fn()} />
    );

    expect(routeHtml).not.toContain(secret);
    expect(globalHtml).not.toContain(secret);
    expect(routeHtml).toContain("Reference: safe-digest-123");
    expect(globalHtml).toContain("Reference: safe-digest-123");
  });

  it("rejects malformed digests instead of reflecting them", () => {
    expect(publicErrorReference({ digest: "<script>alert(1)</script>" })).toBeNull();
    expect(publicErrorReference({ digest: "valid_ABC-123" })).toBe(
      "Reference: valid_ABC-123"
    );
  });
});
