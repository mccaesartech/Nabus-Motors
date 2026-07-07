import { NextRequest, NextResponse } from "next/server";
import { fetchAllVehicles } from "@/lib/supabase/vehicles";
import { getRelatedVehicles } from "@/lib/vehicle-recommendations";

export async function POST(req: NextRequest) {
  let body: { vehicleId?: string; limit?: number };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.vehicleId?.trim()) {
    return NextResponse.json({ error: "vehicleId required" }, { status: 400 });
  }

  const vehicles = await fetchAllVehicles();
  const seed = vehicles.find((v) => v.id === body.vehicleId || v.slug === body.vehicleId);
  if (!seed) {
    return NextResponse.json({ vehicles: [] });
  }

  const related = getRelatedVehicles(vehicles, seed, Math.min(body.limit ?? 4, 8));

  return NextResponse.json(
    { vehicles: related },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
