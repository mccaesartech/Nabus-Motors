/** Public admin path segment — keep in sync with ADMIN_PATH env on server */
export const ADMIN_PATH = "tg-console-8f2k";

export function adminLoginPath() {
  return `/${ADMIN_PATH}`;
}

export function adminDashboardPath() {
  return `/${ADMIN_PATH}/dashboard`;
}
