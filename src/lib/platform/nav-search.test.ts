import { describe, expect, it } from "vitest";
import { Car, FileText, LayoutDashboard, ShoppingCart } from "lucide-react";
import type { PlatformNavItem } from "@/lib/platform/nav";
import {
  navItemMatchesSearch,
  rankNavSearchResults,
  scoreNavSearch,
} from "@/lib/platform/nav-search";

function item(
  partial: Pick<PlatformNavItem, "label" | "href"> & Partial<PlatformNavItem>
): PlatformNavItem {
  return {
    icon: LayoutDashboard,
    ...partial,
  };
}

const catalog: PlatformNavItem[] = [
  item({
    label: "Dashboard",
    href: "/platform/dashboard",
    description: "Overview & business health",
    icon: LayoutDashboard,
  }),
  item({
    label: "Sales",
    href: "/platform/sales",
    description: "Deals & quotes",
    icon: ShoppingCart,
  }),
  item({
    label: "Inventory",
    href: "/platform/inventory",
    description: "Your vehicles",
    icon: Car,
  }),
  item({
    label: "Movement Ledger",
    href: "/platform/inventory/movements",
    description: "In/out records & financial trace",
    icon: Car,
  }),
  item({
    label: "Reports",
    href: "/platform/reports",
    description: "Business intelligence",
    icon: FileText,
  }),
  item({
    label: "Freight Orders",
    href: "/platform/freight/orders",
    description: "Active shipments",
    icon: ShoppingCart,
  }),
  item({
    label: "Documents",
    href: "/platform/documents",
    description: "Contracts and files",
    icon: FileText,
  }),
];

describe("nav-search", () => {
  it("ranks label prefix matches above description-only hits", () => {
    const ranked = rankNavSearchResults(catalog, "in");
    expect(ranked.map((r) => r.item.label)).toEqual([
      "Inventory",
      "Movement Ledger",
    ]);
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  it("does not match unrelated pages via weak substrings", () => {
    // Old bug: href/description `.includes("or")` pulled in Reports, Documents, etc.
    const ranked = rankNavSearchResults(catalog, "or");
    expect(ranked.map((r) => r.item.label)).toEqual(["Freight Orders"]);
  });

  it("matches path segments and ranks them below label hits", () => {
    const inventory = scoreNavSearch(catalog[2]!, "inventory");
    const movements = scoreNavSearch(catalog[3]!, "movements");
    expect(inventory).toBeGreaterThan(0);
    expect(movements).toBeGreaterThan(0);
    expect(inventory).toBeGreaterThan(movements);
  });

  it("requires every query term to match", () => {
    expect(navItemMatchesSearch(catalog[3]!, "movement ledger")).toBe(true);
    expect(navItemMatchesSearch(catalog[3]!, "movement sales")).toBe(false);
  });

  it("hides zero-relevance results", () => {
    expect(rankNavSearchResults(catalog, "zzzz")).toEqual([]);
    expect(rankNavSearchResults(catalog, "   ")).toEqual([]);
  });

  it("allows intentional description word-prefix matches for longer queries", () => {
    expect(navItemMatchesSearch(catalog[2]!, "vehicle")).toBe(true);
    expect(navItemMatchesSearch(catalog[2]!, "ve")).toBe(false);
  });
});
