import { NextRequest, NextResponse } from "next/server";
import { dbFailure } from "@/lib/errors/api";
import { requireDirectMutation, requirePermission } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { notDeletedFilter, softDeleteEntity } from "@/lib/platform/trash";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  const auth = await requirePermission("parts");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: true, configured: false, categories: [] });
  }

  const { data, error } = await notDeletedFilter(
    supabase.from("parts_categories").select("*").order("sort_order", { ascending: true })
  );

  if (error) {
    return dbFailure(error, {
      module: "api.admin.parts.categories.GET",
      message: "The parts category could not be saved. Try again.",
    });
  }

  return NextResponse.json({ ok: true, configured: true, categories: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireDirectMutation("parts");
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
    .from("parts_categories")
    .insert({
      name,
      slug,
      description: body.description ?? null,
      icon: body.icon ?? null,
      sort_order: Number(body.sort_order) || 0,
      is_active: body.is_active !== false,
    })
    .select("*")
    .single();

  if (error) {
    return dbFailure(error, {
      module: "api.admin.parts.categories.POST",
      message: "The parts category could not be saved. Try again.",
      request: req,
    });
  }

  return NextResponse.json({ ok: true, category: data });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireDirectMutation("parts");
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
    return NextResponse.json({ ok: false, message: "Category id is required." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const key of ["name", "slug", "description", "icon", "sort_order", "is_active"]) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("parts_categories")
    .update(updates)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return dbFailure(error, {
      module: "api.admin.parts.categories.PATCH",
      message: "The parts category could not be saved. Try again.",
      request: req,
    });
  }

  return NextResponse.json({ ok: true, category: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireDirectMutation("parts");
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, message: "Category id is required." }, { status: 400 });
  }

  const result = await softDeleteEntity(supabase, auth.auth, "part_category", id);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.status ?? 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
