import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import type { VehicleInput } from "@/lib/admin/vehicle-fields";
import { buildVehicleAiLabel, logAiUsage } from "@/lib/ai/usage-log";
import { suggestStockPhotos } from "@/lib/ai/stock-photo-suggestions";

export async function POST(req: NextRequest) {
  const auth = await requirePermission("inventory_edit");
  if (!auth.ok) {
    return NextResponse.json({ ok: false }, { status: auth.status });
  }

  let body: { vehicle?: Partial<VehicleInput>; vehicleId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const vehicle = body.vehicle ?? {};
  const vehicleId =
    typeof body.vehicleId === "string" && body.vehicleId.trim()
      ? body.vehicleId.trim()
      : null;
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
  void logAiUsage({
    auth: auth.auth,
    action: "suggest_photos",
    status: "success",
    vehicleId,
    vehicleSlug: null,
    vehicleLabel: buildVehicleAiLabel(vehicle),
    previewSnippet: `${vehicle.make} ${vehicle.model}`,
    metadata: { source: "suggest-photos" },
  });

  return NextResponse.json({
    ok: true,
    photos,
    disclaimer:
      "These are royalty-free stock photos from Pexels — placeholders only, not photos of your actual vehicle. Upload your own photos for an accurate listing.",
  });
}
