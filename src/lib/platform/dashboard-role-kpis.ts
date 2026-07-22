import type { PlatformPermission, PlatformRole } from "./permissions";
import type { PlatformStats } from "./types";

/** Department personas used for dashboard KPI prioritization. */
export type DashboardPersona =
  | "ceo"
  | "sales"
  | "inventory"
  | "operations"
  | "freight"
  | "customer_support";

export type DashboardKpiKey =
  | "todayRevenue"
  | "vehiclesAvailable"
  | "pendingReservations"
  | "pendingShipments"
  | "appointmentsToday"
  | "messages"
  | "openLeads"
  | "lowStock"
  | "pendingFinance"
  | "freightQuotes"
  | "soldVehicles"
  | "preOrders";

export type DashboardKpiDefinition = {
  key: DashboardKpiKey;
  label: string;
  description: string;
  href?: string;
  format?: "currency" | "number";
  toneFromValue?: (value: number, stats: PlatformStats) => "positive" | "negative" | "neutral";
};

export const DASHBOARD_KPI_DEFINITIONS: Record<DashboardKpiKey, DashboardKpiDefinition> = {
  todayRevenue: {
    key: "todayRevenue",
    label: "Estimated revenue",
    description: "From sold vehicles",
    format: "currency",
    href: "/platform/sales",
    toneFromValue: () => "positive",
  },
  vehiclesAvailable: {
    key: "vehiclesAvailable",
    label: "Vehicles available",
    description: "Ready for sale",
    href: "/platform/inventory",
  },
  pendingReservations: {
    key: "pendingReservations",
    label: "Pending reservations",
    description: "Reserved & pre-order pipeline",
    href: "/platform/inventory?listing=pre_order",
    toneFromValue: (v) => (v > 0 ? "negative" : "neutral"),
  },
  pendingShipments: {
    key: "pendingShipments",
    label: "Pending shipments",
    description: "In transit or awaiting dispatch",
    href: "/platform/freight/orders",
    toneFromValue: (v) => (v > 0 ? "negative" : "neutral"),
  },
  appointmentsToday: {
    key: "appointmentsToday",
    label: "Appointments today",
    description: "Scheduled viewings & test drives",
    href: "/platform/appointments",
  },
  messages: {
    key: "messages",
    label: "Unread messages",
    description: "Notifications & alerts",
    href: "/platform/notifications",
    toneFromValue: (v) => (v > 0 ? "negative" : "neutral"),
  },
  openLeads: {
    key: "openLeads",
    label: "Open leads",
    description: "Inquiries needing follow-up",
    href: "/platform/leads?status=new",
    toneFromValue: (v) => (v > 0 ? "negative" : "neutral"),
  },
  lowStock: {
    key: "lowStock",
    label: "Low stock alert",
    description: "Inventory below threshold",
    href: "/platform/inventory",
    toneFromValue: (v) => (v > 0 ? "negative" : "positive"),
  },
  pendingFinance: {
    key: "pendingFinance",
    label: "Pending finance",
    description: "Loan applications to review",
    href: "/platform/finance",
    toneFromValue: (v) => (v > 0 ? "negative" : "neutral"),
  },
  freightQuotes: {
    key: "freightQuotes",
    label: "Freight quotes",
    description: "Inbound quote requests",
    href: "/platform/freight/quotes",
    toneFromValue: (v) => (v > 0 ? "negative" : "neutral"),
  },
  soldVehicles: {
    key: "soldVehicles",
    label: "Vehicles sold",
    description: "Lifetime sold count",
    href: "/platform/sales",
    toneFromValue: () => "positive",
  },
  preOrders: {
    key: "preOrders",
    label: "Active pre-orders",
    description: "Awaiting payment & confirmed",
    href: "/platform/leads?tab=preorder",
    toneFromValue: (v) => (v > 0 ? "negative" : "neutral"),
  },
};

/** KPI sets shown per department persona (primary cards first). */
export const PERSONA_KPI_KEYS: Record<DashboardPersona, DashboardKpiKey[]> = {
  ceo: [
    "todayRevenue",
    "vehiclesAvailable",
    "soldVehicles",
    "openLeads",
    "pendingReservations",
    "pendingShipments",
  ],
  sales: [
    "openLeads",
    "appointmentsToday",
    "pendingReservations",
    "preOrders",
    "todayRevenue",
    "messages",
  ],
  inventory: [
    "vehiclesAvailable",
    "pendingReservations",
    "lowStock",
    "preOrders",
    "soldVehicles",
  ],
  operations: [
    "pendingShipments",
    "appointmentsToday",
    "openLeads",
    "pendingReservations",
    "messages",
  ],
  freight: [
    "pendingShipments",
    "freightQuotes",
    "messages",
    "openLeads",
  ],
  customer_support: [
    "messages",
    "openLeads",
    "appointmentsToday",
    "pendingReservations",
  ],
};

type SessionPermissions = Record<PlatformPermission, boolean>;

/**
 * Map platform role + permissions to a dashboard persona without changing the permission system.
 * Legacy job titles (Sales Officer, Finance Officer) normalize to staff via permissions.ts.
 */
export function resolveDashboardPersona(
  role: PlatformRole,
  permissions: SessionPermissions
): DashboardPersona {
  if (role === "owner" || role === "super_admin") return "ceo";
  if (permissions.reports) return "ceo";
  if (permissions.freight && !permissions.sales && !permissions.inventory_edit) return "freight";
  if (permissions.inventory_edit || (permissions.inventory && role === "manager")) return "inventory";
  if (permissions.messages && !permissions.sales && role === "staff") return "customer_support";
  if (permissions.finance && !permissions.sales) return "operations";
  if (role === "manager") return "operations";
  if (permissions.sales || permissions.leads) return "sales";
  return "customer_support";
}

export type DashboardKpiValues = Partial<Record<DashboardKpiKey, number>>;

export function buildKpiValues(
  stats: PlatformStats,
  extras: {
    pendingShipments?: number;
    appointmentsToday?: number;
    freightQuotes?: number;
  } = {}
): DashboardKpiValues {
  const preOrderPipeline =
    (stats.inventoryChartPreOrderPending ?? 0) + (stats.inventoryChartPreOrderConfirmed ?? 0);

  return {
    todayRevenue: stats.estimatedRevenue,
    vehiclesAvailable: stats.availableVehicles,
    pendingReservations: (stats.reservedVehicles ?? 0) + preOrderPipeline,
    pendingShipments: extras.pendingShipments ?? 0,
    appointmentsToday: extras.appointmentsToday ?? 0,
    messages: stats.unreadNotifications ?? 0,
    openLeads: stats.totalLeads,
    lowStock: stats.lowStock ? 1 : 0,
    pendingFinance: stats.pendingFinance,
    freightQuotes: extras.freightQuotes ?? 0,
    soldVehicles: stats.soldVehicles ?? 0,
    preOrders: preOrderPipeline || stats.newPreorder || 0,
  };
}

export function getKpisForPersona(
  persona: DashboardPersona,
  values: DashboardKpiValues,
  permissions: SessionPermissions
): Array<{ definition: DashboardKpiDefinition; value: number }> {
  return PERSONA_KPI_KEYS[persona]
    .filter((key) => {
      if (key === "pendingFinance" && !permissions.finance) return false;
      if (key === "freightQuotes" && !permissions.freight) return false;
      if (key === "pendingShipments" && !permissions.freight && !permissions.leads) return false;
      return true;
    })
    .map((key) => ({
      definition: DASHBOARD_KPI_DEFINITIONS[key],
      value: values[key] ?? 0,
    }));
}
