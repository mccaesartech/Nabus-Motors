import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/errors/api";
import { canDeleteCustomer, requirePermission } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { fetchAdminCustomers } from "@/lib/platform/customers-admin";

export async function GET(req: NextRequest) {
  const auth = await requirePermission("customers");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, configured: false, customers: [] });
  }

  const search = req.nextUrl.searchParams.get("search") ?? undefined;
  const showDeleted =
    req.nextUrl.searchParams.get("showDeleted") === "1" && canDeleteCustomer(auth.auth);

  try {
    const customers = await fetchAdminCustomers(supabase, { search, showDeleted });
    return NextResponse.json({ ok: true, configured: true, customers });
  } catch (error) {
    return apiFailure(error, {
      module: "api.admin.customers.GET",
      message: "Could not load customers.",
      request: req,
    });
  }
}
