import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { verifyCronSecret } from "@/lib/cron/auth";
import { applyInventoryPhotoColorCorrections } from "@/lib/vehicles/apply-photo-color-corrections";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req: NextRequest) {
  const cronOk = verifyCronSecret(req);
  if (!cronOk) {
    const auth = await requirePermission("inventory_edit");
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: auth.status });
    }
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  const result = await applyInventoryPhotoColorCorrections({ force });
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
