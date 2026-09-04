import { ADMIN_PATH } from "./paths";

export { ADMIN_PATH, adminLoginPath, adminDashboardPath } from "./paths";

export const ADMIN_COOKIE = "nm_admin_session";
export const PLATFORM_USER_COOKIE = "tg_platform_session";

/** Resolved path may differ if ADMIN_PATH env is set */
export function resolvedAdminPath() {
  return process.env.ADMIN_PATH ?? ADMIN_PATH;
}

export function isAdminSessionSecretConfigured(): boolean {
  return Boolean(process.env.ADMIN_SECRET?.trim());
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function adminTokenForPassword(password: string): Promise<string | null> {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!password || !secret) return null;
  return sha256Hex(`${password}:${secret}`);
}

export async function expectedAdminToken(): Promise<string | null> {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) return null;
  return adminTokenForPassword(password);
}
