import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { syncCustomerAccount } from "@/lib/customer/preorder-account";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { CustomerInquirySummary } from "@/lib/customer/types";

const PREORDER_SELECT =
  "id, status, payment_status, down_payment_usd, created_at, vehicle_slug, vehicle_title, is_custom_request, reference_code, vehicle:vehicles(year, make, model, trim, slug)";

async function fetchPreorderInquiries(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  userId: string,
  email: string
) {
  const byUserOrEmail = await supabase
    .from("preorder_inquiries")
    .select(PREORDER_SELECT)
    .or(`user_id.eq.${userId},email.ilike.${email}`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!byUserOrEmail.error) {
    return byUserOrEmail;
  }

  console.warn("[customer/inquiries] preorder query (user_id+email):", byUserOrEmail.error.message);

  return supabase
    .from("preorder_inquiries")
    .select(PREORDER_SELECT)
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(50);
}

export async function GET(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user?.email) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, inquiries: [] });
  }

  await syncCustomerAccount(user.id, user.email);

  const email = user.email.trim().toLowerCase();
  const inquiries: CustomerInquirySummary[] = [];

  const [contact, vehicle, preorder, finance] = await Promise.all([
    supabase
      .from("contact_inquiries")
      .select("id, subject, message, status, created_at")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("vehicle_inquiries")
      .select("id, inquiry_type, vehicle_name, status, created_at")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(20),
    fetchPreorderInquiries(supabase, user.id, email),
    supabase
      .from("finance_applications")
      .select("id, vehicle_of_interest, status, created_at")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  for (const row of contact.data ?? []) {
    inquiries.push({
      id: row.id,
      type: "contact",
      title: row.subject ?? String(row.message ?? "Contact inquiry").slice(0, 80),
      status: row.status ?? "new",
      created_at: row.created_at,
    });
  }

  for (const row of vehicle.data ?? []) {
    inquiries.push({
      id: row.id,
      type: "vehicle",
      title: `${row.inquiry_type} — ${row.vehicle_name ?? "Vehicle inquiry"}`,
      status: row.status ?? "new",
      created_at: row.created_at,
    });
  }

  if (preorder.error) {
    console.error("[customer/inquiries] preorder fetch failed:", preorder.error.message);
  }

  for (const row of preorder.data ?? []) {
    const vehicle = row.vehicle as
      | { year?: number; make?: string; model?: string; trim?: string; slug?: string }
      | null
      | undefined;
    const rowTitle = (row as { vehicle_title?: string | null }).vehicle_title;
    const isCustom = (row as { is_custom_request?: boolean }).is_custom_request === true;
    const referenceCode = (row as { reference_code?: string | null }).reference_code;
    const vehicleLabel = vehicle
      ? [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ")
      : rowTitle?.trim() || (isCustom ? "Custom vehicle request" : "Pre-order");
    inquiries.push({
      id: row.id,
      type: "preorder",
      title: isCustom ? `Custom request — ${vehicleLabel}` : vehicleLabel,
      status: row.status ?? "new",
      created_at: row.created_at,
      down_payment_usd: isCustom ? undefined : row.down_payment_usd ?? undefined,
      payment_status: isCustom ? undefined : row.payment_status ?? undefined,
      vehicle_slug: row.vehicle_slug ?? vehicle?.slug ?? undefined,
      is_custom_request: isCustom,
      reference_code: referenceCode ?? undefined,
    });
  }

  for (const row of finance.data ?? []) {
    inquiries.push({
      id: row.id,
      type: "finance",
      title: `Financing — ${row.vehicle_of_interest ?? "Application"}`,
      status: row.status ?? "pending",
      created_at: row.created_at,
    });
  }

  inquiries.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return NextResponse.json({ ok: true, inquiries });
}
