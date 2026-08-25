import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  PLATFORM_USER_COOKIE,
  adminDashboardPath,
  isAdminSessionSecretConfigured,
} from "@/lib/admin/config";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import { logPlatformActivity } from "@/lib/platform/activity";
import { normalizeRole } from "@/lib/platform/permissions";
import {
  buildPlatformSessionCookieValue,
  PLATFORM_SESSION_TTL_SEC,
} from "@/lib/platform/session";
import { platformForcedPasswordChangeRedirectUrl } from "@/lib/platform/paths";
import { isSchemaMissing, SCHEMA_CAPS } from "@/lib/observability/schema-capability";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  authSessionCookieOptions,
  clearAuthSessionCookieOptions,
} from "@/lib/security/session-cookie-options";
import { schedulePlatformLoginAlert } from "@/lib/notifications/platform-login-notify";

type PlatformUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  password_hash: string;
  phone?: string | null;
  must_change_password?: boolean;
};

async function resolveMustChangePassword(user: PlatformUserRow): Promise<boolean> {
  if (typeof user.must_change_password === "boolean") {
    return user.must_change_password;
  }
  if (isSchemaMissing(SCHEMA_CAPS.platformUsersMustChangePassword)) return false;

  const supabase = createAdminSupabase();
  if (!supabase) return false;

  const { data } = await supabase
    .from("platform_users")
    .select("must_change_password")
    .eq("id", user.id)
    .maybeSingle();

  return Boolean(data?.must_change_password);
}

export async function buildPlatformLoginResponse(user: PlatformUserRow): Promise<NextResponse> {
  if (!isAdminSessionSecretConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Server authentication is not configured." },
      { status: 503 }
    );
  }

  const mustChangePassword = await resolveMustChangePassword(user);
  const sessionValue = await buildPlatformSessionCookieValue(
    user.id,
    normalizeRole(user.role),
    user.password_hash,
    { mustChangePassword }
  );

  const auth: PlatformAuthContext = {
    type: "user",
    userId: user.id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
  };

  const res = NextResponse.json({
    ok: true,
    redirect: mustChangePassword
      ? platformForcedPasswordChangeRedirectUrl()
      : adminDashboardPath(),
    mustChangePassword,
  });
  res.cookies.set(
    PLATFORM_USER_COOKIE,
    sessionValue,
    authSessionCookieOptions(PLATFORM_SESSION_TTL_SEC)
  );
  res.cookies.set(ADMIN_COOKIE, "", clearAuthSessionCookieOptions());

  await logPlatformActivity(auth, "login");
  schedulePlatformLoginAlert({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: auth.role,
    phone: user.phone,
    // IP/UA resolved inside notify via request headers() when available.
  });
  return res;
}
