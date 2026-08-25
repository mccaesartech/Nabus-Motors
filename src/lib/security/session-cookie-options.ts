import { PLATFORM_SESSION_TTL_SEC } from "@/lib/platform/session";

export type AuthSessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

/**
 * Cookie flags for platform / owner bootstrap sessions.
 * httpOnly blocks XSS exfil; SameSite=lax reduces CSRF; secure in production.
 */
export function authSessionCookieOptions(
  maxAgeSeconds: number = PLATFORM_SESSION_TTL_SEC,
  nodeEnv: string | undefined = process.env.NODE_ENV
): AuthSessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: nodeEnv === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Clear a session cookie (logout / cross-cookie swap). */
export function clearAuthSessionCookieOptions(): Pick<
  AuthSessionCookieOptions,
  "httpOnly" | "path" | "maxAge"
> {
  return { httpOnly: true, path: "/", maxAge: 0 };
}
