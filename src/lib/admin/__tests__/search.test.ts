import { describe, expect, it } from "vitest";
import {
  buildOrIlike,
  escapeIlike,
  groupSearchResults,
  ilikePattern,
  matchesSearchQuery,
  MAX_ADMIN_SEARCH_LENGTH,
  SEARCH_TYPE_PERMISSION,
} from "@/lib/admin/search";
import {
  looksLikeIdQuery,
  looksLikeVinQuery,
  looksLikeYearQuery,
  normalizePhoneDigits,
  normalizeVin,
  rankByScore,
  scoreFieldMatch,
  scoreSearchRecord,
  tokenizeQuery,
} from "@/lib/admin/search-ranking";

describe("admin search query construction", () => {
  it("escapes SQL wildcard characters before adding contains semantics", () => {
    expect(escapeIlike(String.raw`50%_off\sale`)).toBe(
      String.raw`50\%\_off\\sale`
    );
    expect(ilikePattern("  civic%  ")).toBe(String.raw`%civic\%%`);
  });

  it("quotes PostgREST OR values so delimiters remain search text", () => {
    expect(buildOrIlike(["make", "model"], '%a,b"c%')).toBe(
      'make.ilike."%a,b\\"c%",model.ilike."%a,b\\"c%"'
    );
  });

  it("keeps the server query cap intentionally small", () => {
    expect(MAX_ADMIN_SEARCH_LENGTH).toBe(100);
  });

  it("maps result types to platform permissions", () => {
    expect(SEARCH_TYPE_PERMISSION.customer).toBe("customers");
    expect(SEARCH_TYPE_PERMISSION.part).toBe("parts");
    expect(SEARCH_TYPE_PERMISSION.vehicle).toBe("inventory");
  });

  it("groups parts ahead of leads", () => {
    const groups = groupSearchResults([
      {
        id: "lead-1",
        type: "lead",
        title: "Lead",
        subtitle: "",
        badge: "Lead",
        href: "/l",
      },
      {
        id: "part-1",
        type: "part",
        title: "Filter",
        subtitle: "SKU-1",
        badge: "Part",
        href: "/p",
      },
    ]);
    expect(groups.map((g) => g.type)).toEqual(["part", "lead"]);
  });
});

describe("admin search ranking helpers", () => {
  it("normalizes VINs by stripping separators", () => {
    expect(normalizeVin("WBA-1234 567")).toBe("WBA1234567");
  });

  it("normalizes phone digits", () => {
    expect(normalizePhoneDigits("+233 24-123-4567")).toBe("233241234567");
  });

  it("tokenizes multi-word vehicle queries", () => {
    expect(tokenizeQuery("  2020 BMW  X5 ")).toEqual(["2020", "bmw", "x5"]);
  });

  it("ranks exact VIN / SKU higher than loose contains", () => {
    const exactVin = scoreFieldMatch(
      { value: "WBA8E9C50JA123456", kind: "vin" },
      "WBA8E9C50JA123456"
    );
    const partial = scoreFieldMatch(
      { value: "WBA8E9C50JA123456", kind: "vin" },
      "123456"
    );
    expect(exactVin).toBeGreaterThan(partial);
    expect(exactVin).toBeGreaterThanOrEqual(1000);
  });

  it("ranks prefix matches above substring contains for text", () => {
    const prefix = scoreFieldMatch({ value: "Toyota Camry", kind: "text" }, "toy");
    const contains = scoreFieldMatch({ value: "My Toyota", kind: "text" }, "toy");
    expect(prefix).toBeGreaterThan(contains);
  });

  it("tolerates a single-character typo on make/model tokens", () => {
    const score = scoreSearchRecord(
      [{ value: "Toyota Camry", kind: "text" }],
      "Toytoa"
    );
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it("rejects junk fuzzy that does not resemble any field", () => {
    const score = scoreSearchRecord(
      [{ value: "Toyota Camry", kind: "text" }],
      "zzzzzz"
    );
    expect(score).toBe(0);
  });

  it("requires all tokens in multi-word queries unless the phrase matches", () => {
    const hit = scoreSearchRecord(
      [
        { value: "2020 BMW X5", kind: "text" },
        { value: 2020, kind: "year" },
      ],
      "2020 BMW X5"
    );
    const miss = scoreSearchRecord(
      [{ value: "2020 BMW X5", kind: "text" }],
      "2020 Audi Q7"
    );
    expect(hit).toBeGreaterThan(0);
    expect(miss).toBe(0);
  });

  it("matches phone suffixes without requiring exact formatting", () => {
    const score = scoreSearchRecord(
      [{ value: "+233 24 123 4567", kind: "phone" }],
      "241234567"
    );
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it("detects VIN / year / id shaped queries", () => {
    expect(looksLikeYearQuery("2020")).toBe(true);
    expect(looksLikeVinQuery("WBA8E9C50JA123456")).toBe(true);
    expect(looksLikeIdQuery("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(looksLikeIdQuery("TGA-CR-1001")).toBe(true);
    expect(looksLikeIdQuery("hi there")).toBe(false);
  });

  it("sorts results by score descending", () => {
    expect(rankByScore([{ score: 10 }, { score: 90 }, { score: 40 }]).map((r) => r.score)).toEqual([
      90, 40, 10,
    ]);
  });

  it("uses smart matching from matchesSearchQuery", () => {
    expect(matchesSearchQuery("2020 Toyota Camry White", "toytoa camry")).toBe(true);
    expect(matchesSearchQuery("2020 Toyota Camry White", "zzzz")).toBe(false);
  });
});
