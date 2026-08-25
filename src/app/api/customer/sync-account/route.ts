import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { isSessionPreference } from "@/lib/customer/session-preference";
import { syncCustomerAccount } from "@/lib/customer/preorder-account";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import type { VehiclePreferenceStore } from "@/lib/vehicle-preferences";
import { syncPendingVehicleInterest } from "@/lib/vehicle-interest/server";
import type { PendingVehicleInterest } from "@/lib/vehicle-interest/types";
import { upsertCustomerSession } from "@/lib/customer/sessions";
import { requestIp } from "@/lib/security/rate-limit";

/**
 * After profile sync: track device fingerprint and alert on new devices.
 * Also records login history when the client marks a fresh sign-in.
 */
async function touchSessionAndMaybeAlert(params: {
  req: NextRequest;
  userId: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  recordLogin?: boolean;
  loginMethod?: string;
}): Promise<void> {
  const ip = requestIp(params.req.headers);
  const userAgent = params.req.headers.get("user-agent");

  try {
    const touch = await upsertCustomerSession({
      userId: params.userId,
      ip,
      userAgent,
    });

    // Always evaluate new-device notify (handles first-send retries after failure).
    void import("@/lib/customer/security-notify")
      .then(async ({ maybeNotifyNewDeviceLogin, maybeNotifyLoginAlert }) => {
        const newDeviceSent = await maybeNotifyNewDeviceLogin({
          userId: params.userId,
          email: params.email,
          phone: params.phone,
          customerName: params.fullName,
          fingerprint: touch.fingerprint,
          isNewSession: touch.isNew,
          userAgent,
          ip,
        });
        if (params.recordLogin) {
          await maybeNotifyLoginAlert({
            userId: params.userId,
            email: params.email,
            phone: params.phone,
            customerName: params.fullName,
            userAgent,
            ip,
            skipIfNewDeviceSent: newDeviceSent,
          });
        }
      })
      .catch(() => {});
  } catch {
    // non-blocking
  }

  if (!params.recordLogin) return;

  try {
    const { recordCustomerAuthAttempt } = await import(
      "@/lib/customer/auth-security"
    );
    await recordCustomerAuthAttempt({
      email: params.email,
      userId: params.userId,
      ip,
      userAgent,
      success: true,
      method: params.loginMethod || "password",
    });
  } catch {
    // non-blocking — migration 087 may be pending
  }
}

export async function POST(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user?.email) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  let sessionPreference: string | undefined;
  let vehiclePreferences: VehiclePreferenceStore | undefined;
  let vehicleInterestPending: PendingVehicleInterest[] | undefined;
  let recordLogin = false;
  let loginMethod = "password";
  try {
    const body = await req.json();
    sessionPreference = body?.sessionPreference;
    vehiclePreferences = body?.vehiclePreferences;
    vehicleInterestPending = body?.vehicleInterestPending;
    recordLogin = Boolean(body?.recordLogin);
    if (typeof body?.loginMethod === "string" && body.loginMethod.trim()) {
      loginMethod = body.loginMethod.trim().slice(0, 32);
    }
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
  let profilePhone: string | null =
    typeof user.user_metadata?.phone === "string"
      ? user.user_metadata.phone
      : null;
  if (adminSupabase) {
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.phone?.trim()) {
      profilePhone = profile.phone.trim();
    }
    if (vehicleInterestPending?.length) {
      await syncPendingVehicleInterest(
        adminSupabase,
        user.id,
        user.email,
        profilePhone,
        vehicleInterestPending
      );
    }
  }

  const fullName =
    (typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null) ||
    (typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : null);

  const result = await syncCustomerAccount(user.id, user.email, {
    fullName,
    phone: profilePhone,
  });

  await touchSessionAndMaybeAlert({
    req,
    userId: user.id,
    email: user.email,
    fullName,
    phone: profilePhone,
    recordLogin,
    loginMethod,
  });

  // Account sync succeeded; welcome.emailSent is authoritative for Resend delivery.
  return NextResponse.json({
    ok: true,
    registrationId: result.registrationId,
    linkedPreorders: result.linkedPreorders,
    linkedFreightQuotes: result.linkedFreightQuotes,
    linkedPartsOrders: result.linkedPartsOrders,
    welcome: result.welcome ?? null,
  });
}
