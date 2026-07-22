/** Platform routes live under /admin so the admin PWA scope (/admin) covers the full app. */
export const PLATFORM_PATH = "admin/platform";

export function platformPathPrefix() {
  return `/${PLATFORM_PATH}`;
}

export function platformDashboardPath() {
  return `${platformPathPrefix()}/dashboard`;
}

export function platformPath(segment: string) {
  return `${platformPathPrefix()}/${segment}`;
}

/** Legacy /platform/* URLs — redirected to /admin/platform/* in next.config. */
export const LEGACY_PLATFORM_PATH = "platform";
