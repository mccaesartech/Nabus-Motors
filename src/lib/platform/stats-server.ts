import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { computeInventoryChartSegments } from "@/lib/platform/inventory-chart";
import { countLeadPipelineStages } from "@/lib/platform/lead-pipeline";
import { countOpenInquiries } from "@/lib/platform/notifications";
import { getAdminSiteSettings, isLowStock, toOperationalSettings } from "@/lib/platform/site-settings";
import { notDeletedFilter } from "@/lib/platform/trash-types";
import { countAvailableVehicleUnits } from "@/lib/vehicles/available-units";

const OPEN_STATUSES = ["new", "pending"];

const TABLES_WITH_SOFT_DELETE = new Set([
  "vehicles",
  "expenses",
  "sales",
  "parts_orders",
  "preorder_inquiries",
  "contact_inquiries",
  "finance_applications",
  "appraisal_requests",
  "vehicle_inquiries",
]);

export type PlatformStatsPayload = {
  totalVehicles: number;
  availableVehicles: number;
  featuredVehicles: number;
  soldVehicles: number;
  reservedVehicles: number;
  preOrderVehicles: number;
  preOrderPipelineCount: number;
  inventoryChartAvailable: number;
  inventoryChartPreOrderPending: number;
  inventoryChartPreOrderConfirmed: number;
  inventoryChartReserved: number;
  inventoryChartSold: number;
  totalPreorderInquiries: number;
  downPaymentPaidCount: number;
  newContact: number;
  newVehicle: number;
  newPreorder: number;
  pendingFinance: number;
  pendingAppraisal: number;
  leadPipelineNew: number;
  leadPipelineContacted: number;
  leadPipelineQualified: number;
  leadPipelineWon: number;
  leadPipelineLost: number;
  leadPipelineTotal: number;
  newsletter: number;
  totalLeads: number;
  estimatedRevenue: number;
  unreadNotifications: number;
  lowStock: boolean;
};

async function fetchInventoryChartSegments(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>
) {
  const [vehiclesRes, preordersRes] = await Promise.all([
    notDeletedFilter(supabase.from("vehicles").select("id, status")),
    notDeletedFilter(
      supabase.from("preorder_inquiries").select("vehicle_id, payment_status, status")
    ),
  ]);

  if (vehiclesRes.error) {
    console.error("[stats] inventory chart vehicles:", vehiclesRes.error.message);
  }
  if (preordersRes.error) {
    console.error("[stats] inventory chart preorders:", preordersRes.error.message);
  }

  return computeInventoryChartSegments(vehiclesRes.data ?? [], preordersRes.data ?? []);
}

async function computePlatformStats(): Promise<PlatformStatsPayload | null> {
  const supabase = createAdminSupabase();
  if (!supabase) return null;

  const operational = toOperationalSettings(await getAdminSiteSettings());

  const count = async (
    table: string,
    filter?: { column: string; value: string | boolean }
  ) => {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (TABLES_WITH_SOFT_DELETE.has(table)) {
      q = notDeletedFilter(q);
    }
    if (filter) q = q.eq(filter.column, filter.value);
    const { count: n, error } = await q;
    if (error) {
      console.error(`[stats] count ${table}:`, error.message);
      return 0;
    }
    return n ?? 0;
  };

  const countOpen = async (table: string) => {
    let q = supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .in("status", OPEN_STATUSES);
    if (TABLES_WITH_SOFT_DELETE.has(table)) {
      q = notDeletedFilter(q);
    }
    const { count: n, error } = await q;
    if (error) {
      console.error(`[stats] open count ${table}:`, error.message);
      return 0;
    }
    return n ?? 0;
  };

  const [
    totalVehicles,
    availableVehicles,
    featuredVehicles,
    soldVehicles,
    reservedVehicles,
    preOrderVehicles,
    totalPreorderInquiries,
    downPaymentPaidCount,
    openInquiries,
    leadPipeline,
    newsletter,
    soldVehiclesData,
    unreadNotifications,
    inventoryChart,
  ] = await Promise.all([
    count("vehicles"),
    // Available units (sums per-listing stock_quantity, migration 082).
    countAvailableVehicleUnits(supabase).then((units) => units ?? 0),
    count("vehicles", { column: "featured", value: true }),
    count("vehicles", { column: "status", value: "sold" }),
    count("vehicles", { column: "status", value: "reserved" }),
    count("vehicles", { column: "status", value: "pre_order" }),
    count("preorder_inquiries"),
    count("preorder_inquiries", { column: "payment_status", value: "down_payment_paid" }),
    countOpenInquiries(supabase),
    countLeadPipelineStages(supabase),
    count("newsletter_subscribers"),
    notDeletedFilter(supabase.from("vehicles").select("price")).eq("status", "sold"),
    supabase
      .from("admin_notifications")
      .select("*", { count: "exact", head: true })
      .is("read_at", null)
      .then(({ count: n, error }) => (error ? null : (n ?? 0))),
    fetchInventoryChartSegments(supabase),
  ]);

  const newContact = openInquiries.contact;
  const newVehicle = openInquiries.vehicle;
  const newPreorder = openInquiries.preorder;
  const pendingFinance = openInquiries.finance;
  const pendingAppraisal = openInquiries.appraisal;

  const estimatedRevenue =
    soldVehiclesData.data?.reduce((sum, v) => sum + (v.price ?? 0), 0) ?? 0;

  const totalLeads =
    newContact + newVehicle + newPreorder + pendingFinance + pendingAppraisal;

  const lowStock =
    operational.notifyLowStockEnabled &&
    isLowStock(availableVehicles, operational.lowStockThreshold);
  const notificationCount =
    unreadNotifications !== null
      ? unreadNotifications + (lowStock ? 1 : 0)
      : totalLeads + (lowStock ? 1 : 0);

  return {
    totalVehicles,
    availableVehicles,
    featuredVehicles,
    soldVehicles,
    reservedVehicles,
    preOrderVehicles,
    preOrderPipelineCount:
      inventoryChart.preOrderPending + inventoryChart.preOrderConfirmed,
    inventoryChartAvailable: inventoryChart.available,
    inventoryChartPreOrderPending: inventoryChart.preOrderPending,
    inventoryChartPreOrderConfirmed: inventoryChart.preOrderConfirmed,
    inventoryChartReserved: inventoryChart.reserved,
    inventoryChartSold: inventoryChart.sold,
    totalPreorderInquiries,
    downPaymentPaidCount,
    newContact,
    newVehicle,
    newPreorder,
    pendingFinance,
    pendingAppraisal,
    leadPipelineNew: leadPipeline.new,
    leadPipelineContacted: leadPipeline.contacted,
    leadPipelineQualified: leadPipeline.qualified,
    leadPipelineWon: leadPipeline.won,
    leadPipelineLost: leadPipeline.lost,
    leadPipelineTotal: leadPipeline.total,
    newsletter,
    totalLeads,
    estimatedRevenue,
    unreadNotifications: notificationCount,
    lowStock,
  };
}

const getCachedPlatformStats = unstable_cache(
  computePlatformStats,
  ["platform-dashboard-stats"],
  { revalidate: 120 }
);

export async function getPlatformStats(): Promise<PlatformStatsPayload | null> {
  return getCachedPlatformStats();
}
