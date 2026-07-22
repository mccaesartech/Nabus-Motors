import { describe, expect, it } from "vitest";
import {
  buildKpiValues,
  getKpisForPersona,
  resolveDashboardPersona,
} from "@/lib/platform/dashboard-role-kpis";
import { buildSessionPermissions } from "@/lib/platform/permissions";
import type { PlatformStats } from "@/lib/platform/types";

const stats = {
  totalVehicles: 12,
  availableVehicles: 7,
  reservedVehicles: 2,
  soldVehicles: 3,
  inventoryChartPreOrderPending: 1,
  inventoryChartPreOrderConfirmed: 2,
  estimatedRevenue: 100_000,
  totalLeads: 4,
  pendingFinance: 1,
  newPreorder: 3,
  lowStock: false,
  unreadNotifications: 2,
} as PlatformStats;

describe("mobile dashboard summaries", () => {
  it("keeps owner availability and business statistics in the dashboard KPI data", () => {
    const permissions = buildSessionPermissions("owner");
    const persona = resolveDashboardPersona("owner", permissions);
    const cards = getKpisForPersona(persona, buildKpiValues(stats), permissions);

    expect(cards.map(({ definition }) => definition.key)).toEqual(
      expect.arrayContaining([
        "todayRevenue",
        "vehiclesAvailable",
        "soldVehicles",
        "openLeads",
      ])
    );
    expect(
      cards.find(({ definition }) => definition.key === "vehiclesAvailable")?.value
    ).toBe(7);
  });

  it("retains the full availability pipeline rather than relying on chart color", () => {
    const values = buildKpiValues(stats);

    expect(values.vehiclesAvailable).toBe(7);
    expect(values.pendingReservations).toBe(5);
    expect(values.preOrders).toBe(3);
  });
});
