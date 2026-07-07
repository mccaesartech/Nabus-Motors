import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { VehiclePreferenceStore } from "@/lib/vehicle-preferences";

export async function GET(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ vehiclePreferences: null }, { status: 401 });
  }

  const supabase = createServerSupabase();
  if (!supabase) {
    return NextResponse.json({ vehiclePreferences: null });
  }

  const { data } = await supabase
    .from("profiles")
    .select("vehicle_preferences")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    vehiclePreferences: (data?.vehicle_preferences as VehiclePreferenceStore | null) ?? null,
  });
}
