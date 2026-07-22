import { platformDashboardPath } from "@/lib/platform/paths";

/** Public admin path segment — keep in sync with ADMIN_PATH env on server */
export const ADMIN_PATH = "admin";

export function adminLoginPath() {
  return `/${ADMIN_PATH}`;
}

export function adminDashboardPath() {
  return platformDashboardPath();
}
