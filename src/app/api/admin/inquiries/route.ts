import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  expectedAdminToken,
} from "@/lib/admin/config";
import { createAdminSupabase } from "@/lib/supabase/admin";

async function isAuthed() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  const expected = await expectedAdminToken();
  return Boolean(token && expected && token === expected);
}

export async function GET(req: NextRequest) {
  if (!(await isAuthed())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const supabase = createAdminSupabase();
  const type = req.nextUrl.searchParams.get("type") ?? "all";

  if (!supabase) {
    return NextResponse.json({
      ok: true,
      configured: false,
      message: "Supabase service role not configured. Inquiries log to server console only.",
      data: { contact: [], finance: [], appraisal: [], vehicle: [], newsletter: [] },
    });
  }

  const fetchTable = async (table: string, order = "created_at") => {
    const { data } = await supabase
      .from(table)
      .select("*")
      .order(order, { ascending: false })
      .limit(100);
    return data ?? [];
  };

  const data: Record<string, unknown[]> = {};

  if (type === "all" || type === "contact") {
    data.contact = await fetchTable("contact_inquiries");
  }
  if (type === "all" || type === "finance") {
    data.finance = await fetchTable("finance_applications");
  }
  if (type === "all" || type === "appraisal") {
    data.appraisal = await fetchTable("appraisal_requests");
  }
  if (type === "all" || type === "vehicle") {
    data.vehicle = await fetchTable("vehicle_inquiries");
  }
  if (type === "all" || type === "newsletter") {
    data.newsletter = await fetchTable("newsletter_subscribers", "subscribed_at");
  }

  return NextResponse.json({ ok: true, configured: true, data });
}
