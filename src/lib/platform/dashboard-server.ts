import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { listDismissedTransactionVehicleIds } from "@/lib/platform/dashboard-dismissals";
import { fetchPreorderInquiries, unifyLeads } from "@/lib/platform/data";
import type {
  DashboardChartVehicle,
  DashboardRecentTransaction,
  InquiryData,
  UnifiedLead,
} from "@/lib/platform/types";

export type DashboardRecentPayload = {
  recentTransactions: DashboardRecentTransaction[];
  recentLeads: UnifiedLead[];
  dismissedVehicleIds: string[];
  failedPayments: number;
};

const RECENT_LIMIT = 6;
const LEAD_TABLE_LIMIT = 12;

function activeRows<T extends { is: (col: string, val: null) => T }>(query: T): T {
  return query.is("deleted_at", null);
}

async function fetchRecentLeads(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>
): Promise<UnifiedLead[]> {
  const fetchTable = async (table: string, order = "created_at") => {
    const { data } = await activeRows(
      supabase.from(table).select("*").order(order, { ascending: false }).limit(LEAD_TABLE_LIMIT)
    );
    return data ?? [];
  };

  const [contact, vehicle, finance, appraisal, preorder, orderRows] = await Promise.all([
    fetchTable("contact_inquiries"),
    fetchTable("vehicle_inquiries"),
    fetchTable("finance_applications"),
    fetchTable("appraisal_requests"),
    fetchPreorderInquiries(supabase).then((rows) => rows.slice(0, LEAD_TABLE_LIMIT)),
    activeRows(
      supabase
        .from("parts_orders")
        .select(
          "id, name, email, phone, status, total_usd, total_label, notes, follow_up_notes, created_at, item_count, vehicle_count, part_count"
        )
        .order("created_at", { ascending: false })
        .limit(LEAD_TABLE_LIMIT)
    ).then(({ data }) => data ?? []),
  ]);

  const data: InquiryData = {
    contact,
    vehicle,
    finance,
    appraisal,
    preorder,
    order: orderRows,
    newsletter: [],
  };

  return unifyLeads(data).slice(0, RECENT_LIMIT);
}

async function fetchRecentTransactions(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  dismissedVehicleIds: string[]
): Promise<DashboardRecentTransaction[]> {
  const dismissedSet = new Set(dismissedVehicleIds);

  const { data: preorderRows } = await supabase
    .from("preorder_inquiries")
    .select("vehicle_id, payment_status")
    .is("deleted_at", null)
    .eq("payment_status", "down_payment_paid")
    .not("vehicle_id", "is", null);

  const confirmedPreorderVehicleIds = new Set(
    (preorderRows ?? [])
      .map((row) => row.vehicle_id as string)
      .filter((id) => id && !dismissedSet.has(id))
  );

  const { data: soldReserved } = await supabase
    .from("vehicles")
    .select("id, year, make, model, price, status, created_at")
    .is("deleted_at", null)
    .in("status", ["sold", "reserved"])
    .order("created_at", { ascending: false })
    .limit(RECENT_LIMIT * 4);

  let confirmedVehicles: DashboardRecentTransaction[] = [];
  if (confirmedPreorderVehicleIds.size > 0) {
    const { data } = await supabase
      .from("vehicles")
      .select("id, year, make, model, price, status, created_at")
      .is("deleted_at", null)
      .in("id", [...confirmedPreorderVehicleIds])
      .order("created_at", { ascending: false });
    confirmedVehicles = (data ?? []) as DashboardRecentTransaction[];
  }

  const byId = new Map<string, DashboardRecentTransaction>();
  for (const vehicle of [...(soldReserved ?? []), ...confirmedVehicles]) {
    if (!dismissedSet.has(vehicle.id)) {
      byId.set(vehicle.id, vehicle as DashboardRecentTransaction);
    }
  }

  return [...byId.values()]
    .sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    )
    .slice(0, RECENT_LIMIT);
}

async function fetchFailedPaymentCount(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>
): Promise<number> {
  const { count } = await supabase
    .from("preorder_inquiries")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .or("payment_status.eq.cancelled,status.eq.cancelled");

  return count ?? 0;
}

async function computeDashboardRecent(): Promise<DashboardRecentPayload | null> {
  const supabase = createAdminSupabase();
  if (!supabase) return null;

  const dismissedVehicleIds = await listDismissedTransactionVehicleIds(supabase);

  const [recentTransactions, recentLeads, failedPayments] = await Promise.all([
    fetchRecentTransactions(supabase, dismissedVehicleIds),
    fetchRecentLeads(supabase),
    fetchFailedPaymentCount(supabase),
  ]);

  return {
    recentTransactions,
    recentLeads,
    dismissedVehicleIds,
    failedPayments,
  };
}

async function computeDashboardChartVehicles(): Promise<DashboardChartVehicle[]> {
  const supabase = createAdminSupabase();
  if (!supabase) return [];

  const { data, error } = await activeRows(
    supabase
      .from("vehicles")
      .select("id, year, make, model, price, status, body_type, created_at")
      .order("created_at", { ascending: false })
      .limit(400)
  );

  if (error) {
    console.error("[dashboard] chart vehicles:", error.message);
    return [];
  }

  return (data ?? []) as DashboardChartVehicle[];
}

const getCachedDashboardRecent = unstable_cache(
  computeDashboardRecent,
  ["platform-dashboard-recent"],
  { revalidate: 60, tags: ["platform-dashboard-recent"] }
);

export async function getDashboardRecent(): Promise<DashboardRecentPayload | null> {
  return getCachedDashboardRecent();
}

const getCachedDashboardChartVehicles = unstable_cache(
  computeDashboardChartVehicles,
  ["platform-dashboard-chart-vehicles"],
  { revalidate: 120, tags: ["platform-dashboard-chart-vehicles"] }
);

export async function getDashboardChartVehicles(): Promise<DashboardChartVehicle[]> {
  return getCachedDashboardChartVehicles();
}
