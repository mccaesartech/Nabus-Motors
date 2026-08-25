import { describe, expect, it } from "vitest";
import {
  quotePostgrestFilterValue,
  userOrEmailFilter,
} from "@/lib/security/postgrest-filter";

describe("SQL injection / PostgREST filter encoding", () => {
  it("quotes commas and quotes so filter operators cannot break out", () => {
    const injected = 'x")or(1.eq.1),email.eq.(y';
    const quoted = quotePostgrestFilterValue(injected);
    expect(quoted.startsWith('"')).toBe(true);
    expect(quoted.endsWith('"')).toBe(true);
    expect(quoted).toContain('\\"');
    // Delimiters are data, not structural .or() separators
    expect(userOrEmailFilter("uid-1", injected)).toBe(
      `user_id.eq."uid-1",email.ilike.${quoted}`
    );
  });

  it("escapes backslashes used in classic breakout payloads", () => {
    expect(quotePostgrestFilterValue('a\\b"c')).toBe('"a\\\\b\\"c"');
  });

  it("treats OR-like email payloads as a single eq/ilike value", () => {
    const email = "victim@example.com,role.eq.owner";
    const filter = userOrEmailFilter("user-9", email);
    expect(filter).toBe(
      'user_id.eq."user-9",email.ilike."victim@example.com,role.eq.owner"'
    );
    expect(filter).toContain('"victim@example.com,role.eq.owner"');
  });
});
