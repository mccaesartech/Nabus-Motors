import { NextRequest, NextResponse } from "next/server";
import {
  checkCustomerLoginAllowed,
  recordCustomerAuthAttempt,
} from "@/lib/customer/auth-security";
import { notifyFailedLoginAttempt } from "@/lib/customer/security-notify";
import { assertSameOrigin, forbiddenOriginResponse } from "@/lib/security/csrf";
import { consumeRateLimit, requestIp } from "@/lib/security/rate-limit";

/**
 * Report a failed customer sign-in so the account owner can be notified.
 * Response is always generic and never reveals whether the email is registered.
 */
export async function POST(req: NextRequest) {
  if (!assertSameOrigin(req)) {
    return forbiddenOriginResponse();
  }

  const ip = requestIp(req.headers);
  const burst = consumeRateLimit("customer-login-attempt-report", ip, {
    limit: 30,
    windowMs: 15 * 60_000,
  });
  if (!burst.allowed) {
    return NextResponse.json({ ok: true });
  }

  const body = await req.json().catch(() => ({}));
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const method =
    typeof body.method === "string" && body.method.trim()
      ? body.method.trim().slice(0, 32)
      : "password";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: true });
  }

  const userAgent = req.headers.get("user-agent");

  const allowed = await checkCustomerLoginAllowed(email, req.headers);
  if (!allowed.allowed) {
    return NextResponse.json({ ok: true });
  }

  try {
    await recordCustomerAuthAttempt({
      email,
      ip,
      userAgent,
      success: false,
      reason: "invalid_credentials",
    });
  } catch {
    // non-blocking
  }

  void notifyFailedLoginAttempt({
    email,
    ip,
    userAgent,
    method,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}