import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import { revalidatePublicSite } from "@/lib/admin/revalidate";
import { fetchPreorderInquiryById } from "@/lib/platform/data";
import { SALE_STATUSES, type SaleStatus } from "@/lib/platform/sales";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { applySoldStatusTransition } from "@/lib/vehicles/stock-automation";
import { notDeletedFilter, softDeleteEntity } from "@/lib/platform/trash";

const SALE_SELECT = `
  *,
  vehicle:vehicles (
    id, year, make, model, trim, price, status
  )
`;

async function upsertCustomer(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  email: string,
  name: string,
  phone?: string | null
) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const parts = name.trim().split(/\s+/);
  const first_name = parts[0] ?? name;
  const last_name = parts.slice(1).join(" ") || null;

  const { data, error } = await supabase
    .from("customers")
    .insert({
      email: normalized,
      first_name,
      last_name,
      phone: phone ?? null,
      source: "platform",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[upsertCustomer]", error.message);
    return null;
  }
  return data.id as string;
}

async function completeSale(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  saleId: string,
  vehicleId: string | null,
  preorderInquiryId: string | null,
  auth?: PlatformAuthContext | null
) {
  const now = new Date().toISOString();

  await supabase
    .from("sales")
    .update({ status: "completed", sale_date: now, updated_at: now })
    .eq("id", saleId);

  if (vehicleId) {
    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("id, slug, make, model, year")
      .eq("id", vehicleId)
      .maybeSingle();

    if (vehicle) {
      await applySoldStatusTransition(supabase, vehicle, {
        auth,
        source: "sale_completed",
      });
    } else {
      await supabase.from("vehicles").update({ status: "sold" }).eq("id", vehicleId);
    }
  }

  if (preorderInquiryId) {
    await supabase
      .from("preorder_inquiries")
      .update({ payment_status: "completed", status: "sold" })
      .eq("id", preorderInquiryId);
  }

  revalidatePublicSite();
}

async function revertSaleConversion(
  supabase: NonNullable<ReturnType<typeof createAdminSupabase>>,
  saleId: string
) {
  const { data: sale } = await supabase
    .from("sales")
    .select("id, status, vehicle_id, preorder_inquiry_id")
    .eq("id", saleId)
    .maybeSingle();

  if (!sale) {
    return { ok: false as const, message: "Sale not found", status: 404 };
  }

  const preorderInquiryId = sale.preorder_inquiry_id as string | null;
  if (!preorderInquiryId) {
    return {
      ok: false as const,
      message: "Sale is not linked to a pre-order",
      status: 400,
    };
  }

  if (sale.status === "cancelled") {
    return { ok: false as const, message: "Sale already reverted", status: 400 };
  }

  const { data: preorder } = await supabase
    .from("preorder_inquiries")
    .select("id, payment_status, status, vehicle_id")
    .eq("id", preorderInquiryId)
    .maybeSingle();

  const vehicleId =
    (sale.vehicle_id as string | null) ??
    (preorder?.vehicle_id as string | null) ??
    null;
  const now = new Date().toISOString();

  await supabase
    .from("sales")
    .update({ status: "cancelled", updated_at: now })
    .eq("id", saleId);

  const preorderUpdates: Record<string, string> = {};
  if (preorder?.status === "sold") {
    preorderUpdates.status = "qualified";
  }
  if (preorder?.payment_status === "completed") {
    preorderUpdates.payment_status = "down_payment_paid";
  }

  if (Object.keys(preorderUpdates).length > 0) {
    await supabase
      .from("preorder_inquiries")
      .update(preorderUpdates)
      .eq("id", preorderInquiryId);
  }

  if (vehicleId) {
    const hadDownPayment =
      preorder?.payment_status === "down_payment_paid" ||
      preorder?.payment_status === "completed";
    const newVehicleStatus = hadDownPayment ? "reserved" : "available";

    await supabase
      .from("vehicles")
      .update({ status: newVehicleStatus })
      .eq("id", vehicleId)
      .in("status", ["sold", "reserved"]);
  }

  revalidatePublicSite();
  return { ok: true as const };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      configured: false,
      sales: [],
      convertiblePreorders: [],
    });
  }

  const [salesRes, preordersRes, linkedRes] = await Promise.all([
    notDeletedFilter(supabase.from("sales").select(SALE_SELECT)).order("created_at", {
      ascending: false,
    }),
    supabase
      .from("preorder_inquiries")
      .select(
        `
        id, name, email, phone, down_payment_usd, payment_status, vehicle_price_usd, vehicle_id,
        vehicle:vehicles (id, year, make, model, trim, price, status)
      `
      )
      .eq("payment_status", "down_payment_paid")
      .order("created_at", { ascending: false }),
    supabase
      .from("sales")
      .select("preorder_inquiry_id, status")
      .not("preorder_inquiry_id", "is", null)
      .neq("status", "cancelled"),
  ]);

  if (salesRes.error) {
    console.error("[sales GET]", salesRes.error.message);
  }

  const linkedIds = new Set(
    (linkedRes.data ?? [])
      .map((r) => r.preorder_inquiry_id)
      .filter(Boolean) as string[]
  );

  const convertiblePreorders = (preordersRes.data ?? []).filter(
    (p) => !linkedIds.has(p.id)
  );

  return NextResponse.json({
    ok: true,
    configured: true,
    sales: salesRes.data ?? [],
    convertiblePreorders,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const body = await req.json();
  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase not configured" }, { status: 503 });
  }

  if (body.preorder_inquiry_id) {
    const preorder = await fetchPreorderInquiryById(supabase, String(body.preorder_inquiry_id));
    if (!preorder) {
      return NextResponse.json({ ok: false, message: "Pre-order not found" }, { status: 404 });
    }
    if (preorder.payment_status !== "down_payment_paid" && preorder.payment_status !== "completed") {
      return NextResponse.json(
        { ok: false, message: "Pre-order must have down payment received" },
        { status: 400 }
      );
    }

    const { data: existingSale } = await supabase
      .from("sales")
      .select("id")
      .eq("preorder_inquiry_id", preorder.id)
      .neq("status", "cancelled")
      .maybeSingle();

    if (existingSale) {
      return NextResponse.json(
        {
          ok: false,
          message: "Pre-order already converted to a sale",
          sale_id: existingSale.id,
        },
        { status: 409 }
      );
    }

    const vehicle = Array.isArray(preorder.vehicle) ? preorder.vehicle[0] : preorder.vehicle;
    const vehicleId = preorder.vehicle_id ?? vehicle?.id ?? null;
    const salePrice = preorder.vehicle_price_usd ?? vehicle?.price ?? 0;

    const customerId = await upsertCustomer(
      supabase,
      preorder.email,
      preorder.name,
      preorder.phone
    );

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 14);

    const { data, error } = await supabase
      .from("sales")
      .insert({
        customer_id: customerId,
        vehicle_id: vehicleId,
        preorder_inquiry_id: preorder.id,
        customer_name: preorder.name,
        customer_email: preorder.email,
        sale_price: Math.round(salePrice),
        status: "accepted",
        valid_until: validUntil.toISOString().slice(0, 10),
        notes: body.notes ? String(body.notes) : null,
      })
      .select(SALE_SELECT)
      .single();

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sale: data });
  }

  const vehicle_id = body.vehicle_id ? String(body.vehicle_id) : null;
  const customer_name = String(body.customer_name ?? "").trim();
  const customer_email = String(body.customer_email ?? "").trim();
  const sale_price = Math.round(Number(body.sale_price));
  const valid_until = String(body.valid_until ?? "").slice(0, 10);
  const notes = body.notes ? String(body.notes).trim() : null;
  const status = (SALE_STATUSES.includes(body.status) ? body.status : "draft") as SaleStatus;

  if (!vehicle_id || !customer_name || !customer_email || !Number.isFinite(sale_price) || sale_price <= 0) {
    return NextResponse.json({ ok: false, message: "Invalid quotation data" }, { status: 400 });
  }

  if (!valid_until) {
    return NextResponse.json({ ok: false, message: "Valid until date is required" }, { status: 400 });
  }

  const customerId = await upsertCustomer(supabase, customer_email, customer_name);

  const { data, error } = await supabase
    .from("sales")
    .insert({
      customer_id: customerId,
      vehicle_id,
      customer_name,
      customer_email,
      sale_price,
      status,
      valid_until,
      notes,
    })
    .select(SALE_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sale: data });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const body = await req.json();
  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase not configured" }, { status: 503 });
  }

  const { data: existing } = await supabase
    .from("sales")
    .select("id, status, vehicle_id, preorder_inquiry_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ ok: false, message: "Sale not found" }, { status: 404 });
  }

  if (body.action === "revert") {
    const result = await revertSaleConversion(supabase, id);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: result.message },
        { status: result.status }
      );
    }
    const { data } = await supabase.from("sales").select(SALE_SELECT).eq("id", id).single();
    return NextResponse.json({ ok: true, sale: data });
  }

  if (body.status === "completed") {
    await completeSale(
      supabase,
      id,
      existing.vehicle_id as string | null,
      existing.preorder_inquiry_id as string | null,
      auth.auth
    );
    const { data } = await supabase.from("sales").select(SALE_SELECT).eq("id", id).single();
    return NextResponse.json({ ok: true, sale: data });
  }

  const updates: Record<string, unknown> = {};
  if (body.status && SALE_STATUSES.includes(body.status)) {
    updates.status = body.status;
  }
  if (body.sale_price !== undefined) updates.sale_price = Math.round(Number(body.sale_price));
  if (body.valid_until !== undefined) updates.valid_until = String(body.valid_until).slice(0, 10);
  if (body.notes !== undefined) updates.notes = body.notes ? String(body.notes) : null;

  if (!Object.keys(updates).length) {
    return NextResponse.json({ ok: false, message: "No updates" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("sales")
    .update(updates)
    .eq("id", id)
    .select(SALE_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sale: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, message: "Missing id" }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase not configured" }, { status: 503 });
  }

  const { data: existing } = await supabase
    .from("sales")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (existing?.status === "completed") {
    return NextResponse.json(
      { ok: false, message: "Completed sales cannot be deleted" },
      { status: 400 }
    );
  }

  const result = await softDeleteEntity(supabase, auth.auth, "sale", id);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.status ?? 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
