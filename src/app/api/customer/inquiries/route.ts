import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { syncCustomerAccount } from "@/lib/customer/preorder-account";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { CustomerInquirySummary } from "@/lib/customer/types";
import { parseCustomRequestSpecs } from "@/lib/platform/custom-request";
import { userOrEmailFilter } from "@/lib/security/postgrest-filter";

const PREORDER_SELECT_FULL =
  "id, status, payment_status, down_payment_usd, vehicle_price_usd, created_at, vehicle_slug, vehicle_title, is_custom_request, reference_code, requested_make, requested_model, requested_year, requested_specs, budget_min, budget_max, matched_vehicle_id, vehicle:vehicles(year, make, model, trim, slug), matched_vehicle:vehicles!preorder_inquiries_matched_vehicle_id_fkey(slug, make, model, year)";

const PREORDER_SELECT_LEGACY =
  "id, status, payment_status, down_payment_usd, vehicle_price_usd, created_at, vehicle_slug, vehicle_title, vehicle:vehicles(year, make, model, trim, slug)";

type PreorderInquiryRow = {
  id: string;
  status?: string | null;
  payment_status?: string | null;
  down_payment_usd?: number | null;
  vehicle_price_usd?: number | null;
  created_at: string;
  vehicle_slug?: string | null;
  vehicle_title?: string | null;
  is_custom_request?: boolean;
  reference_code?: string | null;
  requested_make?: string | null;
  requested_model?: string | null;
  requested_year?: string | null;
  requested_specs?: unknown;
  budget_min?: number | null;
  budget_max?: number | null;
  matched_vehicle_id?: string | null;
  vehicle?:
    | { year?: number; make?: string; model?: string; trim?: string; slug?: string }
    | Array<{ year?: number; make?: string; model?: string; trim?: string; slug?: string }>
    | null;
  matched_vehicle?: { slug?: string; make?: string; model?: string; year?: number } | null;
};

type PreorderInquiryResult = { data: PreorderInquiryRow[] | null; error: { message: string } | null };

function isMissingColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("column") && lower.includes("does not exist");
}

async function runPreorderSelect(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  select: string,
  userId: string,
  email: string,
  emailOnly: boolean
): Promise<PreorderInquiryResult> {
  let query = supabase.from("preorder_inquiries").select(select);

  if (emailOnly) {
    query = query.ilike("email", email);
  } else {
    query = query.or(userOrEmailFilter(userId, email));
  }

  const result = await query.order("created_at", { ascending: false }).limit(50);

  if (result.error) {
    return { data: null, error: result.error };
  }

  return {
    data: (result.data ?? []) as unknown as PreorderInquiryRow[],
    error: null,
  };
}

async function fetchPreorderWithFallback(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  select: string,
  userId: string,
  email: string,
  emailOnly: boolean
): Promise<PreorderInquiryResult> {
  const result = await runPreorderSelect(supabase, select, userId, email, emailOnly);
  if (!result.error) return result;
  if (isMissingColumnError(result.error.message) && select !== PREORDER_SELECT_LEGACY) {
    console.warn("[customer/inquiries] custom request columns missing, using legacy select");
    return runPreorderSelect(supabase, PREORDER_SELECT_LEGACY, userId, email, emailOnly);
  }
  return result;
}

async function fetchPreorderInquiries(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  userId: string,
  email: string
): Promise<PreorderInquiryResult> {
  const result = await fetchPreorderWithFallback(
    supabase,
    PREORDER_SELECT_FULL,
    userId,
    email,
    false
  );

  if (!result.error) {
    return result;
  }

  console.warn("[customer/inquiries] preorder query (user_id+email):", result.error.message);

  return fetchPreorderWithFallback(supabase, PREORDER_SELECT_FULL, userId, email, true);
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
    const vehicleData = row.vehicle;
    const vehicleRow = Array.isArray(vehicleData) ? vehicleData[0] : vehicleData;
    const matchedVehicle = row.matched_vehicle;
    const rowTitle = row.vehicle_title;
    const isCustom = row.is_custom_request === true;
    const referenceCode = row.reference_code;
    const requestedMake = row.requested_make;
    const requestedModel = row.requested_model;
    const requestedYear = row.requested_year;
    const requestedSpecs = parseCustomRequestSpecs(row.requested_specs);
    const budgetMin = row.budget_min;
    const budgetMax = row.budget_max;
    const matchedVehicleId = row.matched_vehicle_id;

    const customLabel = [requestedYear, requestedMake, requestedModel]
      .filter(Boolean)
      .join(" ")
      .trim();
    const vehicleLabel = vehicleRow
      ? [vehicleRow.year, vehicleRow.make, vehicleRow.model, vehicleRow.trim]
          .filter(Boolean)
          .join(" ")
      : rowTitle?.trim() || customLabel || (isCustom ? "Custom vehicle request" : "Pre-order");

    inquiries.push({
      id: String(row.id),
      type: "preorder",
      title: isCustom ? `Custom request — ${vehicleLabel}` : vehicleLabel,
      status: String(row.status ?? "new"),
      created_at: String(row.created_at),
      down_payment_usd: isCustom ? undefined : (row.down_payment_usd as number | null) ?? undefined,
      vehicle_price_usd: isCustom ? undefined : (row.vehicle_price_usd as number | null) ?? undefined,
      payment_status: isCustom ? undefined : (row.payment_status as string | null) ?? undefined,
      vehicle_slug: (row.vehicle_slug as string | null) ?? vehicleRow?.slug ?? undefined,
      is_custom_request: isCustom,
      reference_code: referenceCode ?? undefined,
      requested_make: requestedMake ?? undefined,
      requested_model: requestedModel ?? undefined,
      requested_year: requestedYear ?? undefined,
      requested_specs: isCustom ? requestedSpecs : undefined,
      budget_min: isCustom ? budgetMin ?? undefined : undefined,
      budget_max: isCustom ? budgetMax ?? undefined : undefined,
      matched_vehicle_id: matchedVehicleId ?? undefined,
      matched_vehicle_slug: matchedVehicle?.slug ?? undefined,
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
