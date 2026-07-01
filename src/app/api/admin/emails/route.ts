import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import {
  countFailedEmails,
  fetchReceivedCommunications,
  fetchSentEmails,
} from "@/lib/platform/emails";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const auth = await requirePermission("emails");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      configured: false,
      items: [],
      total: 0,
      failedCount: 0,
      inboundConfigured: false,
    });
  }

  const params = req.nextUrl.searchParams;
  const summary = params.get("summary") === "1";

  if (summary) {
    const failedCount = await countFailedEmails(supabase);
    return NextResponse.json({ ok: true, configured: true, failedCount });
  }

  const tab = params.get("tab") === "received" ? "received" : "sent";
  const page = Number(params.get("page") ?? 1);
  const limit = Number(params.get("limit") ?? 50);
  const id = params.get("id") ?? undefined;
  const from = params.get("from") ?? undefined;
  const to = params.get("to") ?? undefined;

  if (tab === "received") {
    const type = params.get("type") ?? "all";
    const result = await fetchReceivedCommunications(supabase, {
      page,
      limit,
      id,
      from,
      to,
      type,
    });

    return NextResponse.json({
      ok: true,
      configured: true,
      tab,
      inboundConfigured: false,
      inboundNote:
        "Inbound email parsing is not configured. Showing contact form submissions and customer messages.",
      items: result.items,
      total: result.total,
      page,
      limit,
      failedCount: await countFailedEmails(supabase),
    });
  }

  const status = params.get("status") ?? "all";
  const template = params.get("template") ?? "all";
  const result = await fetchSentEmails(supabase, {
    page,
    limit,
    id,
    from,
    to,
    status,
    template,
  });

  return NextResponse.json({
    ok: true,
    configured: true,
    tab,
    items: result.items,
    total: result.total,
    templates: result.templates,
    page,
    limit,
    failedCount: await countFailedEmails(supabase),
    inboundConfigured: false,
  });
}
