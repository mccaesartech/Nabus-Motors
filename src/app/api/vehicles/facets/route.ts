import { NextRequest, NextResponse } from "next/server";
import { parseFiltersFromSearchParams } from "@/lib/vehicles";
import { queryVehicleFacetCounts } from "@/lib/supabase/vehicle-queries";

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const filters = parseFiltersFromSearchParams(params);
  const facets = await queryVehicleFacetCounts(filters);

  return NextResponse.json(facets, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
    },
  });
}
