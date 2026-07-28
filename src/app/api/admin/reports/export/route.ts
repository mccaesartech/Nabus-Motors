import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/admin/auth";
import { apiFailure } from "@/lib/errors/api";
import { logPlatformActivity } from "@/lib/platform/activity";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  exportLeadsCsv,
  exportPreordersCsv,
  exportVehiclesCsv,
  fetchAllPreorderInquiries,
  unifyLeads,
} from "@/lib/platform/data";
import type { InquiryData } from "@/lib/platform/types";
import { exportSalesCsv, type SaleRow } from "@/lib/platform/sales";
import { isInStockStatus } from "@/lib/vehicles/availability";

export const dynamic = "force-dynamic";

function inDateRange(value: string, from?: string, to?: string) {
  if (!from && !to) return true;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return true;
  if (from && time < new Date(from).getTime()) return false;
  if (to && time > new Date(`${to}T23:59:59`).getTime()) return false;
  return true;
}

async function fetchTableRows(
  supabase: SupabaseClient,
  table: string,
  orderColumn = "created_at"
) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order(orderColumn, { ascending: false });

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return data ?? [];
}

function csvResponse(filename: string, content: string) {
  return new NextResponse(`\uFEFF${content}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission("reports");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message ?? "Unauthorized" },
      { status: auth.status }
    );
  }

  const type = req.nextUrl.searchParams.get("type") ?? "inventory";
  const from = req.nextUrl.searchParams.get("from") ?? undefined;
  const to = req.nextUrl.searchParams.get("to") ?? undefined;
  const date = new Date().toISOString().slice(0, 10);

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Supabase service role not configured. Add SUPABASE_SERVICE_ROLE_KEY to environment variables.",
      },
      { status: 503 }
    );
  }

  try {
    let filename = `true-goshen-${type}-${date}.csv`;
    let content = "";

    if (type === "inventory") {
      const rows = await fetchTableRows(supabase, "vehicles");
      const filtered = rows.filter(
        (row) =>
          isInStockStatus(String(row.status ?? "available")) &&
          inDateRange(String(row.created_at ?? ""), from, to)
      );
      content = exportVehiclesCsv(filtered);
    } else if (type === "leads") {
      const tables = [
        "contact_inquiries",
        "vehicle_inquiries",
        "finance_applications",
        "appraisal_requests",
      ] as const;

      const data: InquiryData = {
        contact: [],
        vehicle: [],
        finance: [],
        appraisal: [],
        preorder: [],
        newsletter: [],
      };

      for (const table of tables) {
        const key =
          table === "contact_inquiries"
            ? "contact"
            : table === "vehicle_inquiries"
              ? "vehicle"
              : table === "finance_applications"
                ? "finance"
                : "appraisal";
        const rows = await fetchTableRows(supabase, table);
        data[key] = rows.filter((row) =>
          inDateRange(String(row.created_at ?? ""), from, to)
        ) as never;
      }

      const preorder = await fetchAllPreorderInquiries(supabase);
      data.preorder = preorder.filter((row) =>
        inDateRange(String(row.created_at ?? ""), from, to)
      ) as never;

      content = exportLeadsCsv(unifyLeads(data));
    } else if (type === "preorders") {
      const preorder = await fetchAllPreorderInquiries(supabase);
      const filtered = preorder.filter((row) =>
        inDateRange(String(row.created_at ?? ""), from, to)
      );
      content = exportPreordersCsv(filtered);
      filename = `true-goshen-preorders-${date}.csv`;
    } else if (type === "sales") {
      const { data, error } = await supabase
        .from("sales")
        .select(
          `
          *,
          vehicle:vehicles (id, year, make, model, trim, price, status)
        `
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`sales: ${error.message}`);
      }

      const filtered = (data ?? []).filter((row) =>
        inDateRange(String(row.created_at ?? ""), from, to)
      ) as SaleRow[];
      content = exportSalesCsv(filtered);
      filename = `true-goshen-sales-${date}.csv`;
    } else {
      return NextResponse.json(
        { ok: false, message: "Invalid export type" },
        { status: 400 }
      );
    }

    await logPlatformActivity(auth.auth, "export", type, { from, to });
    return csvResponse(filename, content);
  } catch (err) {
    return apiFailure(err, {
      module: "api.admin.reports.export.GET",
      message: "The export could not be generated. Try again.",
      request: req,
      actor: { id: auth.auth.userId, role: auth.auth.role, type: auth.auth.type },
      context: { type, from, to },
    });
  }
}
