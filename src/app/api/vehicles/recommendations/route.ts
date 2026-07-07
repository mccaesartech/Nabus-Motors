import { NextRequest, NextResponse } from "next/server";
import { fetchAllVehicles } from "@/lib/supabase/vehicles";
import { getRecommendations } from "@/lib/vehicle-recommendations";
import type { VehiclePreferenceStore } from "@/lib/vehicle-preferences";

export async function POST(req: NextRequest) {
  let body: {
    preferences?: VehiclePreferenceStore;
    excludeIds?: string[];
    limit?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const preferences = body.preferences;
  if (!preferences?.attributeScores) {
    return NextResponse.json({ error: "preferences required" }, { status: 400 });
  }

  const vehicles = await fetchAllVehicles();
  const result = getRecommendations(vehicles, preferences, {
    limit: Math.min(body.limit ?? 6, 12),
    excludeIds: body.excludeIds,
  });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
