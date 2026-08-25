import { afterEach, describe, expect, it } from "vitest";
import {
  getSupabaseServiceRoleKey,
  readJwtRoleClaim,
} from "@/lib/supabase/env";

function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url"
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

describe("readJwtRoleClaim", () => {
  it("reads the role claim from a compact JWT", () => {
    expect(readJwtRoleClaim(fakeJwt({ role: "service_role", ref: "abc" }))).toBe(
      "service_role"
    );
    expect(readJwtRoleClaim(fakeJwt({ role: "anon" }))).toBe("anon");
  });

  it("returns null for non-JWT strings", () => {
    expect(readJwtRoleClaim("not-a-jwt")).toBeNull();
  });
});

describe("getSupabaseServiceRoleKey", () => {
  const original = process.env.SUPABASE_SERVICE_ROLE_KEY;

  afterEach(() => {
    if (original === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = original;
  });

  it("accepts a JWT with role service_role", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = fakeJwt({
      role: "service_role",
      ref: "proj",
    });
    expect(getSupabaseServiceRoleKey()).toBeTruthy();
  });

  it("rejects a JWT with role anon (common mispaste)", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = fakeJwt({ role: "anon", ref: "proj" });
    expect(getSupabaseServiceRoleKey()).toBeNull();
  });

  it("rejects placeholder text", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "your_supabase_service_role_key";
    expect(getSupabaseServiceRoleKey()).toBeNull();
  });
});
