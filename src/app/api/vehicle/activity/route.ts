import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { recordVehicleInterest } from "@/lib/vehicle-interest/server";
import {
  VEHICLE_INTEREST_ACTIVITY_TYPES,
  type VehicleInterestActivityType,
} from "@/lib/vehicle-interest/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const vehicleId = String(body?.vehicle_id ?? "").trim();
    const activityType = String(body?.activity_type ?? "").trim() as VehicleInterestActivityType;

    if (!vehicleId) {
      return NextResponse.json({ ok: false, message: "vehicle_id required" }, { status: 400 });
    }
    if (!VEHICLE_INTEREST_ACTIVITY_TYPES.includes(activityType)) {
      return NextResponse.json({ ok: false, message: "Invalid activity_type" }, { status: 400 });
    }

    const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
    const bodyEmail = body?.email ? String(body.email).trim().toLowerCase() : null;
    const bodyPhone = body?.phone ? String(body.phone).trim() : null;

    const email = user?.email?.trim().toLowerCase() ?? bodyEmail;
    const userId = user?.id ?? null;

    if (!email && !userId) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const supabase = createAdminSupabase();
    if (!supabase) {
      return NextResponse.json({ ok: true, queued: true });
    }

    let phone = bodyPhone;
    if (userId && !phone) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", userId)
        .maybeSingle();
      phone = profile?.phone?.trim() ?? null;
    }

    await recordVehicleInterest(supabase, {
      vehicleId,
      activityType,
      userId,
      email,
      phone,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request" }, { status: 400 });
  }
}
