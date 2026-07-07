import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  inquiryTableForType,
  isInquiryDetailType,
} from "@/lib/platform/lead-detail";
import { notDeletedFilter } from "@/lib/platform/trash";

type RouteContext = { params: Promise<{ type: string; id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const { type, id } = await context.params;
  if (!isInquiryDetailType(type)) {
    return NextResponse.json({ ok: false, message: "Invalid inquiry type" }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const table = inquiryTableForType(type);
  const { data, error } = await notDeletedFilter(supabase.from(table).select("*"))
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, message: "Inquiry not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, type, inquiry: data });
}
