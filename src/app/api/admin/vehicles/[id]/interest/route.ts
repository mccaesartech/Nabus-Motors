import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getVehicleInterestStats } from "@/lib/vehicle-interest/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("inventory");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { id } = await params;
  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      stats: { uniqueEmails: 0, totalActivities: 0, recentActivities: 0 },
    });
  }

  const stats = await getVehicleInterestStats(supabase, id);
  return NextResponse.json({ ok: true, stats });
}
