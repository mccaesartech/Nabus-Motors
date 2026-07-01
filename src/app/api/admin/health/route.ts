import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { checkDbHealth } from "@/lib/supabase/health";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const db = await checkDbHealth();
  return NextResponse.json({ ok: true, db });
}
