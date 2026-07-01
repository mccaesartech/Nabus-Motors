import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import type { VehicleInput } from "@/lib/admin/vehicle-fields";
import { suggestStockPhotos } from "@/lib/ai/stock-photo-suggestions";

export async function POST(req: NextRequest) {
  const auth = await requirePermission("inventory_edit");
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  let body: { vehicle?: Partial<VehicleInput> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const vehicle = body.vehicle ?? {};
  if (!vehicle.make?.trim() || !vehicle.model?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        message: "Enter make and model first so we can suggest relevant stock photos.",
      },
      { status: 400 }
    );
  }

  const photos = suggestStockPhotos(vehicle);

  return NextResponse.json({
    ok: true,
    photos,
    disclaimer:
      "These are royalty-free stock photos from Pexels — placeholders only, not photos of your actual vehicle. Upload your own photos for an accurate listing.",
  });
}
