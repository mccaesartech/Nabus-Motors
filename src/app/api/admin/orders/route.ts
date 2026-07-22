import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { fetchAdminOrders } from "@/lib/platform/orders-admin";

export async function GET() {
  const auth = await requirePermission("parts");
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, orders: [] });
  }

  const orders = await fetchAdminOrders(supabase);
  return NextResponse.json({ ok: true, orders });
}
