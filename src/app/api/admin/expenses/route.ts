import { NextRequest, NextResponse } from "next/server";
import { dbFailure } from "@/lib/errors/api";
import { requireFinanceAccess } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { recordExpenseMovement } from "@/lib/platform/inventory-movements/record";
import { notDeletedFilter, softDeleteEntity } from "@/lib/platform/trash";

const EMPTY_SUMMARY = {
  soldRevenue: 0,
  preorderRevenue: 0,
  totalRevenue: 0,
  totalExpenses: 0,
  profit: 0,
};

export async function GET() {
  const auth = await requireFinanceAccess();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      configured: false,
      expenses: [],
      summary: EMPTY_SUMMARY,
    });
  }

  const [expensesRes, soldRes, preorderRes] = await Promise.all([
    notDeletedFilter(supabase.from("expenses").select("*")).order("expense_date", {
      ascending: false,
    }),
    supabase.from("vehicles").select("price").eq("status", "sold"),
    supabase
      .from("preorder_inquiries")
      .select("down_payment_usd")
      .in("payment_status", ["down_payment_paid", "completed"]),
  ]);

  const expenses = expensesRes.error ? [] : (expensesRes.data ?? []);
  const soldRevenue =
    soldRes.data?.reduce((sum, row) => sum + (Number(row.price) || 0), 0) ?? 0;
  const preorderRevenue =
    preorderRes.data?.reduce((sum, row) => sum + (Number(row.down_payment_usd) || 0), 0) ??
    0;
  const totalExpenses =
    expenses.reduce((sum, row) => sum + (Number(row.amount_usd) || 0), 0);
  const totalRevenue = soldRevenue + preorderRevenue;

  if (expensesRes.error) {
    console.error("Supabase expenses fetch failed:", expensesRes.error.message);
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    expenses,
    summary: {
      soldRevenue,
      preorderRevenue,
      totalRevenue,
      totalExpenses,
      profit: totalRevenue - totalExpenses,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireFinanceAccess();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const body = await req.json();
  const description = String(body.description ?? "").trim();
  const amount_usd = Number(body.amount_usd);
  const expense_date = String(body.expense_date ?? "").slice(0, 10);

  if (!description || !Number.isFinite(amount_usd) || amount_usd <= 0 || !expense_date) {
    return NextResponse.json({ ok: false, message: "Invalid expense data" }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase not configured" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("expenses")
    .insert({ description, amount_usd: Math.round(amount_usd), expense_date })
    .select()
    .single();

  if (error) {
    return dbFailure(error, {
      module: "api.admin.expenses.POST",
      message: "The expense could not be saved. Try again.",
      request: req,
    });
  }

  await recordExpenseMovement(
    supabase,
    {
      id: data.id,
      description: data.description,
      amount_usd: data.amount_usd,
      expense_date: data.expense_date,
    },
    auth.auth
  );

  return NextResponse.json({ ok: true, expense: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireFinanceAccess();
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

  const result = await softDeleteEntity(supabase, auth.auth, "expense", id);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.message },
      { status: result.status ?? 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
