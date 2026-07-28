import { NextRequest, NextResponse } from "next/server";
import { dbFailure } from "@/lib/errors/api";
import { requirePermission } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requirePermission("documents");
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, configured: false, documents: [], vehicles: [] });
  }

  const [docsRes, vehiclesRes] = await Promise.all([
    supabase.from("documents").select("*").order("created_at", { ascending: false }),
    supabase
      .from("vehicles")
      .select("id, year, make, model, slug, price, status")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (docsRes.error) {
    console.error("Supabase documents fetch failed:", docsRes.error.message);
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    documents: docsRes.error ? [] : (docsRes.data ?? []),
    vehicles: vehiclesRes.error ? [] : (vehiclesRes.data ?? []),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission("documents");
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const doc_type = String(body.doc_type ?? "other");
  const url = body.url ? String(body.url).trim() : null;
  const vehicle_id = body.vehicle_id ? String(body.vehicle_id) : null;
  const customer_name = body.customer_name ? String(body.customer_name).trim() : null;

  if (!title) {
    return NextResponse.json({ ok: false, message: "Title required" }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase not configured" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({ title, doc_type, url, vehicle_id, customer_name })
    .select()
    .single();

  if (error) {
    return dbFailure(error, {
      module: "api.admin.documents.POST",
      message: "The document could not be saved. Try again.",
      request: req,
    });
  }

  return NextResponse.json({ ok: true, document: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission("documents");
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

  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) {
    return dbFailure(error, {
      module: "api.admin.documents.DELETE",
      message: "The document could not be saved. Try again.",
      request: req,
    });
  }

  return NextResponse.json({ ok: true });
}
