import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { isSessionPreference } from "@/lib/customer/session-preference";
import { syncCustomerAccount } from "@/lib/customer/preorder-account";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import type { VehiclePreferenceStore } from "@/lib/vehicle-preferences";
import { syncPendingVehicleInterest } from "@/lib/vehicle-interest/server";
import type { PendingVehicleInterest } from "@/lib/vehicle-interest/types";

export async function POST(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user?.email) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  let sessionPreference: string | undefined;
  let vehiclePreferences: VehiclePreferenceStore | undefined;
  let vehicleInterestPending: PendingVehicleInterest[] | undefined;
  try {
    const body = await req.json();
    sessionPreference = body?.sessionPreference;
    vehiclePreferences = body?.vehiclePreferences;
    vehicleInterestPending = body?.vehicleInterestPending;
  } catch {
    // Body optional — sync only
  }

  const supabase = createServerSupabase();
  if (supabase) {
    const updates: Record<string, unknown> = {};

    if (sessionPreference && isSessionPreference(sessionPreference)) {
      updates.session_preference = sessionPreference;
    }

    if (vehiclePreferences?.events?.length) {
      updates.vehicle_preferences = vehiclePreferences;
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("profiles").update(updates).eq("id", user.id);
    }
  }

  const adminSupabase = createAdminSupabase();
  if (adminSupabase && vehicleInterestPending?.length) {
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .maybeSingle();
    await syncPendingVehicleInterest(
      adminSupabase,
      user.id,
      user.email,
      profile?.phone,
      vehicleInterestPending
    );
  }

  const result = await syncCustomerAccount(user.id, user.email);
  return NextResponse.json({ ok: true, ...result });
}
