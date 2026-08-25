import { NextRequest, NextResponse } from "next/server";
import { sendCustomerWelcomeAfterSignup } from "@/lib/customer/welcome-email";
import { consumeRateLimit, requestIp } from "@/lib/security/rate-limit";

/**
 * Fires welcome email/SMS right after client `signUp`, including when email
 * confirmation means there is no session yet (sync-account cannot run).
 * Idempotent via notification_log; verifies auth user + email match server-side.
 */
export async function POST(req: NextRequest) {
  const rateLimit = consumeRateLimit(
    "customer-post-signup-welcome",
    requestIp(req.headers),
    { limit: 10, windowMs: 15 * 60_000 }
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message: "Too many welcome attempts. Please try again shortly.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  let userId = "";
  let email = "";
  let name: string | null = null;
  let phone: string | null = null;

  try {
    const body = await req.json();
    userId = String(body?.userId ?? "").trim();
    email = String(body?.email ?? "").trim();
    name =
      typeof body?.name === "string" && body.name.trim()
        ? body.name.trim()
        : null;
    phone =
      typeof body?.phone === "string" && body.phone.trim()
        ? body.phone.trim()
        : null;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid request body." },
      { status: 400 }
    );
  }

  if (!userId || !email) {
    return NextResponse.json(
      { ok: false, message: "userId and email are required." },
      { status: 400 }
    );
  }

  const result = await sendCustomerWelcomeAfterSignup({
    userId,
    email,
    name,
    phone,
  });

  if (result.emailSent) {
    console.info(
      "[post-signup-welcome] welcome email sent",
      result.smsSent ? "(sms too)" : "(sms skipped or failed)"
    );
  } else {
    console.warn(
      "[post-signup-welcome] welcome not sent:",
      result.reason ?? "unknown"
    );
  }

  return NextResponse.json({
    ok: true,
    welcome: {
      sent: result.sent,
      emailSent: result.emailSent,
      smsSent: result.smsSent,
      ...(result.reason ? { reason: result.reason } : {}),
    },
  });
}
