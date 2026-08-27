import { describe, expect, it } from "vitest";
import { Car, FileText, LayoutDashboard, Mail, Settings, ShoppingCart, UserCog } from "lucide-react";
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

/** Realistic administration items matching production nav labels/hrefs/descriptions. */
const adminCatalog: PlatformNavItem[] = [
  item({
    label: "Emails",
    href: "/platform/emails",
    description: "Sent & received correspondence",
    icon: Mail,
  }),
  item({
    label: "Audit Log",
    href: "/platform/audit-log",
    // Historical description that made "se" hit via Security word-prefix.
    description: "Security & ops activity trail",
    icon: FileText,
  }),
  item({
    label: "Users",
    href: "/platform/users",
    description: "Team and permissions",
    icon: UserCog,
  }),
  item({
    label: "Settings",
    href: "/platform/settings",
    description: "Platform configuration",
    icon: Settings,
  }),
];

describe("nav-search", () => {
  it("ranks label prefix matches above weaker hits for short queries", () => {
    // 1–2 char queries are label-word prefix only — path/description must not pull extras.
    const ranked = rankNavSearchResults(catalog, "in");
    expect(ranked.map((r) => r.item.label)).toEqual(["Inventory"]);
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

  it("allows path segment prefix from length 3 but never mid-segment includes", () => {
    const movementsOnly = item({
      label: "Ledger",
      href: "/platform/inventory/movements",
      description: "Trace",
    });
    expect(navItemMatchesSearch(movementsOnly, "mov")).toBe(true);
    expect(navItemMatchesSearch(movementsOnly, "move")).toBe(true); // segment prefix
    expect(navItemMatchesSearch(movementsOnly, "emen")).toBe(false); // mid-segment
    expect(navItemMatchesSearch(movementsOnly, "mo")).toBe(false);
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
    // Raised bar: 3-char description prefixes are no longer enough.
    expect(navItemMatchesSearch(catalog[2]!, "veh")).toBe(false);
  });

  it("does not allow mid-label includes for queries under 4 chars", () => {
    expect(navItemMatchesSearch(adminCatalog[2]!, "ser")).toBe(false);
    expect(navItemMatchesSearch(adminCatalog[2]!, "user")).toBe(true);
  });

  it("matches se to Settings only among admin pages", () => {
    const ranked = rankNavSearchResults(adminCatalog, "se");
    expect(ranked.map((r) => r.item.label)).toEqual(["Settings"]);
    expect(navItemMatchesSearch(adminCatalog[0]!, "se")).toBe(false); // Emails
    expect(navItemMatchesSearch(adminCatalog[1]!, "se")).toBe(false); // Audit Log
    expect(navItemMatchesSearch(adminCatalog[2]!, "se")).toBe(false); // Users
  });

  it("matches us to Users and not Settings", () => {
    const ranked = rankNavSearchResults(adminCatalog, "us");
    expect(ranked.map((r) => r.item.label)).toEqual(["Users"]);
    expect(navItemMatchesSearch(adminCatalog[3]!, "us")).toBe(false); // Settings
  });

  it("matches audit to Audit Log", () => {
    expect(navItemMatchesSearch(adminCatalog[1]!, "audit")).toBe(true);
    const ranked = rankNavSearchResults(adminCatalog, "audit");
    expect(ranked.map((r) => r.item.label)).toEqual(["Audit Log"]);
    expect(navItemMatchesSearch(adminCatalog[1]!, "sec")).toBe(false);
    expect(navItemMatchesSearch(adminCatalog[1]!, "log")).toBe(true);
    expect(navItemMatchesSearch(adminCatalog[1]!, "audit log")).toBe(true);
  });
});
