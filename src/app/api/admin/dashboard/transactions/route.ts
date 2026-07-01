import { NextRequest, NextResponse } from "next/server";
import { canManageTrash, requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  dismissDashboardTransaction,
  listDismissedTransactionVehicleIds,
} from "@/lib/platform/dashboard-dismissals";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, configured: false, dismissedVehicleIds: [] });
  }

  const dismissedVehicleIds = await listDismissedTransactionVehicleIds(supabase);
  return NextResponse.json({ ok: true, configured: true, dismissedVehicleIds });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  if (!canManageTrash(auth.auth)) {
    return NextResponse.json({ ok: false, message: "Access denied." }, { status: 403 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { vehicleId?: string };
  const vehicleId = body.vehicleId ?? req.nextUrl.searchParams.get("vehicleId");
  if (!vehicleId?.trim()) {
    return NextResponse.json({ ok: false, message: "Missing vehicleId" }, { status: 400 });
  }

  const result = await dismissDashboardTransaction(supabase, auth.auth, vehicleId.trim());
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.status ?? 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
