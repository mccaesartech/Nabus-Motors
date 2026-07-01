export const PLATFORM_PATH = "platform";

export function platformDashboardPath() {
  return `/${PLATFORM_PATH}/dashboard`;
}

export function platformPath(segment: string) {
  return `/${PLATFORM_PATH}/${segment}`;
}
