import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { hasPermission, type PlatformRole } from "@/lib/platform/permissions";
import { notDeletedFilter } from "@/lib/platform/trash-types";

export type DashboardExtras = {
  pendingShipments: number;
  delayedShipments: number;
  appointmentsToday: number;
  freightQuotes: number;
  failedPayments: number;
};

const EMPTY_EXTRAS: DashboardExtras = {
  pendingShipments: 0,
  delayedShipments: 0,
  appointmentsToday: 0,
  freightQuotes: 0,
  failedPayments: 0,
};

function todayIsoDate(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

async function computeDashboardExtrasForRole(role: PlatformRole): Promise<DashboardExtras> {
  const supabase = createAdminSupabase();
  if (!supabase) return EMPTY_EXTRAS;

  const extras = { ...EMPTY_EXTRAS };
  const tasks: Promise<void>[] = [];

  if (hasPermission(role, "freight")) {
    tasks.push(
      (async () => {
        const { count, error } = await supabase
          .from("shipment_tracking")
          .select("*", { count: "exact", head: true })
          .not("status", "in", '("delivered","cancelled")');
        if (!error) extras.pendingShipments = count ?? 0;
      })(),
      (async () => {
        const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
        const { count, error } = await supabase
          .from("shipment_tracking")
          .select("*", { count: "exact", head: true })
          .not("status", "in", '("delivered","cancelled")')
          .lt("updated_at", cutoff);
        if (!error) extras.delayedShipments = count ?? 0;
      })(),
      (async () => {
        const { count, error } = await supabase
          .from("freight_quote_requests")
          .select("*", { count: "exact", head: true })
          .in("status", ["new", "pending"]);
        if (!error) extras.freightQuotes = count ?? 0;
      })()
    );
  }

  if (hasPermission(role, "leads")) {
    const today = todayIsoDate();
    tasks.push(
      (async () => {
        const { count, error } = await supabase
          .from("vehicle_appointments")
          .select("*", { count: "exact", head: true })
          .eq("preferred_date", today)
          .not("status", "in", '("cancelled","completed")');
        if (!error) extras.appointmentsToday = count ?? 0;
      })(),
      (async () => {
        const { count, error } = await notDeletedFilter(
          supabase
            .from("preorder_inquiries")
            .select("*", { count: "exact", head: true })
            .or("payment_status.eq.cancelled,status.eq.cancelled")
        );
        if (!error) extras.failedPayments = count ?? 0;
      })()
    );
  }

  await Promise.all(tasks);
  return extras;
}

const getCachedDashboardExtras = unstable_cache(
  async (role: PlatformRole) => computeDashboardExtrasForRole(role),
  ["platform-dashboard-extras"],
  { revalidate: 60, tags: ["platform-dashboard-extras"] }
);

export async function getDashboardExtras(role: PlatformRole): Promise<DashboardExtras> {
  return getCachedDashboardExtras(role);
}
