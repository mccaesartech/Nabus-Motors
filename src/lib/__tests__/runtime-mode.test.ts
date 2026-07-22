import { describe, expect, it } from "vitest";
import { allowDemoData } from "@/lib/runtime-mode";

describe("runtime demo data policy", () => {
  it("allows demo inventory only in local development", () => {
    expect(allowDemoData("development")).toBe(true);
    expect(allowDemoData("production")).toBe(false);
    expect(allowDemoData("test")).toBe(false);
    expect(allowDemoData(undefined)).toBe(false);
  });
});
