import { NextRequest, NextResponse } from "next/server";
import { resolvePublicVehiclesByIdentifiers } from "@/lib/supabase/vehicles";

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json({ vehicles: [], unresolved: [], catalog: {} });
  }

  const identifiers = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const result = await resolvePublicVehiclesByIdentifiers(identifiers);

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
    },
  });
}
