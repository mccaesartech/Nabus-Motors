import { describe, expect, it } from "vitest";
import {
  buildTrashSearchOrFilter,
  sanitizeTrashSearchTerm,
} from "@/lib/platform/trash-types";

describe("trash search helpers", () => {
  it("strips PostgREST-breaking characters from search terms", () => {
    expect(sanitizeTrashSearchTerm("  Toyota, Camry (VIN)  ")).toBe("Toyota Camry VIN");
    expect(sanitizeTrashSearchTerm("100%_match")).toBe("100 match");
  });

  it("returns null for empty search", () => {
    expect(buildTrashSearchOrFilter("")).toBeNull();
    expect(buildTrashSearchOrFilter("   ")).toBeNull();
    expect(buildTrashSearchOrFilter(",,,")).toBeNull();
  });

  it("builds an or-filter covering label, id, and vehicle snapshot fields", () => {
    const filter = buildTrashSearchOrFilter("Camry");
    expect(filter).toContain('entity_label.ilike."%Camry%"');
    expect(filter).toContain('entity_id.ilike."%Camry%"');
    expect(filter).toContain('snapshot->>make.ilike."%Camry%"');
    expect(filter).toContain('snapshot->>model.ilike."%Camry%"');
    expect(filter).toContain('snapshot->>vin.ilike."%Camry%"');
    expect(filter).toContain('snapshot->>slug.ilike."%Camry%"');
  });
});