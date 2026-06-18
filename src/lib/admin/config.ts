import { createHash } from "crypto";
import { ADMIN_PATH } from "./paths";

export { ADMIN_PATH, adminLoginPath, adminDashboardPath } from "./paths";

export const ADMIN_COOKIE = "tg_admin_session";

/** Server-only — resolved path may differ if ADMIN_PATH env is set */
export function resolvedAdminPath() {
  return process.env.ADMIN_PATH ?? ADMIN_PATH;
}

export function expectedAdminToken(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SECRET ?? "true-goshen-admin-secret";
  if (!password) return null;
  return createHash("sha256").update(`${password}:${secret}`).digest("hex");
}
