import { NextRequest, NextResponse } from "next/server";
import { vehicles } from "@/lib/data/vehicles";

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json({ vehicles: [] });
  }

  const ids = new Set(idsParam.split(",").map((id) => id.trim()).filter(Boolean));
  const matched = vehicles.filter((v) => ids.has(v.id));

  return NextResponse.json({ vehicles: matched });
}
