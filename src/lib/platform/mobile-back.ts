import { platformPath, platformPathPrefix } from "@/lib/platform/paths";

export type PlatformMobileBackTarget = {
  href: string;
  label: string;
};

const PLATFORM_PREFIX = platformPathPrefix();

/** Parent route for nested platform pages — shown in the mobile top bar. */
export function platformMobileBackTarget(pathname: string): PlatformMobileBackTarget | null {
  if (pathname.startsWith(platformPath("account"))) {
    return { href: platformPath("dashboard"), label: "Dashboard" };
  }
  if (pathname.includes("/inventory/new")) {
    return { href: platformPath("inventory"), label: "Inventory" };
  }
  if (pathname.includes("/inventory/") && pathname.endsWith("/edit")) {
    return { href: platformPath("inventory"), label: "Inventory" };
  }
  if (new RegExp(`^${PLATFORM_PREFIX}/customers/[^/]+$`).test(pathname)) {
    return { href: platformPath("customers"), label: "Customers" };
  }
  if (pathname.includes("/leads/preorder/")) {
    return { href: `${platformPath("leads")}?tab=preorder`, label: "Leads" };
  }
  if (pathname.endsWith("/users/activity") || pathname.endsWith("/activity")) {
    return { href: platformPath("users"), label: "Users" };
  }
  return null;
}
