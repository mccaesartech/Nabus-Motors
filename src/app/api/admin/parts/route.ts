import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  recordPartStockChange,
} from "@/lib/platform/inventory-movements/record";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission("parts");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, configured: false, parts: [] });
  }

  const status = req.nextUrl.searchParams.get("status")?.trim();
  let query = supabase
    .from("parts")
    .select("*, parts_categories(id, name, slug)")
    .order("updated_at", { ascending: false })
    .limit(300);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, configured: true, parts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("parts");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, message: "Name is required." }, { status: 400 });
  }

  const slug = String(body.slug ?? "").trim() || slugify(name);
  const { data, error } = await supabase
    .from("parts")
    .insert({
      name,
      slug,
      category_id: body.category_id ?? null,
      sku: body.sku ?? null,
      description: body.description ?? null,
      price_usd: body.price_usd != null ? Number(body.price_usd) : null,
      brand: body.brand ?? null,
      compatible_makes: body.compatible_makes ?? [],
      compatible_models: body.compatible_models ?? [],
      images: body.images ?? [],
      stock_quantity: Number(body.stock_quantity) || 0,
      status: body.status ?? "draft",
      is_featured: Boolean(body.is_featured),
    })
    .select("*, parts_categories(id, name, slug)")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const stockQty = Number(body.stock_quantity) || 0;
  if (stockQty > 0) {
    await recordPartStockChange(
      supabase,
      {
        id: data.id,
        name: data.name,
        sku: data.sku,
        price_usd: data.price_usd,
      },
      stockQty,
      auth.auth
    );
  }

  return NextResponse.json({ ok: true, part: data });
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission("parts");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const body = await req.json();
  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, message: "Part id is required." }, { status: 400 });
  }

  let priorStock: number | null = null;
  if (body.stock_quantity !== undefined) {
    const { data: existing } = await supabase
      .from("parts")
      .select("stock_quantity, name, sku, price_usd")
      .eq("id", id)
      .maybeSingle();
    if (existing) {
      priorStock = Number(existing.stock_quantity) || 0;
    }
  }

  const updates: Record<string, unknown> = {};
  const fields = [
    "name",
    "slug",
    "category_id",
    "sku",
    "description",
    "price_usd",
    "brand",
    "compatible_makes",
    "compatible_models",
    "images",
    "stock_quantity",
    "status",
    "is_featured",
  ] as const;

  for (const field of fields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  const { data, error } = await supabase
    .from("parts")
    .update(updates)
    .eq("id", id)
    .select("*, parts_categories(id, name, slug)")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  if (priorStock != null && body.stock_quantity !== undefined && data) {
    const nextStock = Number(data.stock_quantity) || 0;
    const delta = nextStock - priorStock;
    if (delta !== 0) {
      await recordPartStockChange(
        supabase,
        {
          id: data.id,
          name: data.name,
          sku: data.sku,
          price_usd: data.price_usd,
        },
        delta,
        auth.auth
      );
    }
  }

  return NextResponse.json({ ok: true, part: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission("parts");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, message: "Part id is required." }, { status: 400 });
  }

  const { error } = await supabase.from("parts").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
