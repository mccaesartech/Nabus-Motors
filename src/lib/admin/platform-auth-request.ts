import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, expectedAdminToken, PLATFORM_USER_COOKIE } from "@/lib/admin/config";
import { normalizeRole, type PlatformRole } from "@/lib/platform/permissions";
import { parsePlatformSessionCookieValue } from "@/lib/platform/session";

/** Edge-safe auth resolution for middleware — no Supabase / Node crypto. */
export async function resolvePlatformAuthFromRequest(req: NextRequest): Promise<{
  authenticated: boolean;
  role: PlatformRole | null;
}> {
  const ownerToken = req.cookies.get(ADMIN_COOKIE)?.value;
  const expected = await expectedAdminToken();
  if (ownerToken && expected && ownerToken === expected) {
    return { authenticated: true, role: "owner" };
  }

  const platformCookie = req.cookies.get(PLATFORM_USER_COOKIE)?.value;
  const payload = await parsePlatformSessionCookieValue(platformCookie);
  if (!payload) {
    return { authenticated: false, role: null };
  }

  return { authenticated: true, role: normalizeRole(payload.role) };
}
