import { describeUserAgent } from "@/lib/errors/sanitize";
import { requestIp } from "@/lib/security/rate-limit";

export type AuditRequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
  browser: string | null;
  operatingSystem: string | null;
  requestId: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
};

function headerValue(headers: Headers | null | undefined, name: string): string | null {
  const value = headers?.get(name)?.trim();
  return value || null;
}

/**
 * Best-effort request context for audit rows.
 * Geo uses Cloudflare / Vercel edge headers only — never blocks on an external geo API.
 */
export function auditContextFromRequest(
  request: Request | null | undefined
): AuditRequestContext {
  const headers = request?.headers ?? null;
  const userAgent = headerValue(headers, "user-agent");
  const agent = describeUserAgent(userAgent);
  const ip = headers ? requestIp(headers) : null;

  return {
    ipAddress: ip && ip !== "unknown" ? ip : null,
    userAgent: userAgent ? userAgent.slice(0, 500) : null,
    browser: agent.browser !== "unknown" ? agent.browser : null,
    operatingSystem: agent.os !== "unknown" ? agent.os : null,
    requestId:
      headerValue(headers, "x-vercel-id") ??
      headerValue(headers, "x-request-id") ??
      headerValue(headers, "cf-ray"),
    country:
      headerValue(headers, "cf-ipcountry") ??
      headerValue(headers, "x-vercel-ip-country"),
    region:
      headerValue(headers, "cf-region") ??
      headerValue(headers, "x-vercel-ip-country-region"),
    city:
      headerValue(headers, "cf-ipcity") ??
      headerValue(headers, "x-vercel-ip-city"),
  };
}

export { formatAuditLocation } from "./types";
