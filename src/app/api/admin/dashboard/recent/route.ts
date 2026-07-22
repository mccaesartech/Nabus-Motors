import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getDashboardRecent } from "@/lib/platform/dashboard-server";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      configured: false,
      recentTransactions: [],
      recentLeads: [],
      dismissedVehicleIds: [],
    });
  }

  const recent = await getDashboardRecent();

  return NextResponse.json(
    {
      ok: true,
      configured: true,
      recentTransactions: recent?.recentTransactions ?? [],
      recentLeads: recent?.recentLeads ?? [],
      dismissedVehicleIds: recent?.dismissedVehicleIds ?? [],
      failedPayments: recent?.failedPayments ?? 0,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    }
  );
}
