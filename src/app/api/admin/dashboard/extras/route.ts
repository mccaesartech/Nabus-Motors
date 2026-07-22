import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getDashboardExtras } from "@/lib/platform/dashboard-extras-server";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  const extras = await getDashboardExtras(auth.auth.role);

  return NextResponse.json(
    { ok: true, extras },
    {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    }
  );
}
