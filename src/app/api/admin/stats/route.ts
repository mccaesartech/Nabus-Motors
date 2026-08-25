import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { canViewFinance } from "@/lib/platform/permissions";
import { getPlatformStats } from "@/lib/platform/stats-server";

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
      stats: null,
    });
  }

  const stats = await getPlatformStats();
  const financeVisible = canViewFinance(auth.auth.role);
  const sanitizedStats =
    stats && !financeVisible ? { ...stats, estimatedRevenue: 0 } : stats;

  return NextResponse.json(
    {
      ok: true,
      configured: true,
      stats: sanitizedStats,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    }
  );
}
