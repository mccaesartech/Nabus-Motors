/** Safe in-app path for post-login redirects (blocks open redirects). */
export function sanitizeAuthRedirect(
  path: string | null | undefined,
  fallback = "/account"
): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return fallback;
  }
  return path;
}

/** Read redirect target from login/register query params (`redirect` or `next`). */
export function authRedirectFromSearchParams(
  params: Pick<URLSearchParams, "get">,
  fallback = "/account"
): string {
  return sanitizeAuthRedirect(
    params.get("redirect") ?? params.get("next"),
    fallback
  );
}
