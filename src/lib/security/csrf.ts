import "server-only";

/**
 * Origin check for cookie-authenticated mutating requests (platform admin).
 * SameSite=lax already helps; this blocks obvious cross-site POSTs.
 */
export function assertSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) {
    // Non-browser clients / same-origin navigations may omit Origin.
    const secFetchSite = req.headers.get("sec-fetch-site");
    if (secFetchSite === "cross-site") return false;
    return true;
  }
  try {
    const o = new URL(origin);
    return o.host === host;
  } catch {
    return false;
  }
}

export function forbiddenOriginResponse(): Response {
  return Response.json(
    { ok: false, message: "This request could not be verified. Refresh and try again." },
    { status: 403 }
  );
}
