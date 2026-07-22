import { ADMIN_PATH } from "@/lib/admin/paths";
import { ADMIN_PWA_INSTALL_PATHS } from "@/lib/pwa/constants";
import { platformPathPrefix } from "@/lib/platform/paths";

const adminRoot = `/${ADMIN_PATH}`;

/** True Goshen Admin login and platform workspace (under /admin/*). */
export function isAdminAppPath(pathname: string): boolean {
  return pathname === adminRoot || pathname.startsWith(`${adminRoot}/`);
}

/** Customer-facing routes where the public PWA install prompt may appear. */
export function isCustomerPublicPath(pathname: string): boolean {
  return !isAdminAppPath(pathname);
}

export function isAdminPlatformPath(pathname: string): boolean {
  const prefix = platformPathPrefix();
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Admin PWA install must happen on a URL inside the admin manifest scope. */
export function isAdminPwaInstallPath(pathname: string): boolean {
  const [loginPath, platformPrefix] = ADMIN_PWA_INSTALL_PATHS;
  return (
    pathname === loginPath ||
    pathname === `${loginPath}/` ||
    pathname === platformPrefix ||
    pathname.startsWith(`${platformPrefix}/`)
  );
}
