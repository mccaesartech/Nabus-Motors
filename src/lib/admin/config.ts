import { ADMIN_PATH } from "./paths";

export { ADMIN_PATH, adminLoginPath, adminDashboardPath } from "./paths";

export const ADMIN_COOKIE = "tg_admin_session";

/** Resolved path may differ if ADMIN_PATH env is set */
export function resolvedAdminPath() {
  return process.env.ADMIN_PATH ?? ADMIN_PATH;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function expectedAdminToken(): Promise<string | null> {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SECRET ?? "true-goshen-admin-secret";
  if (!password) return null;
  return sha256Hex(`${password}:${secret}`);
}
