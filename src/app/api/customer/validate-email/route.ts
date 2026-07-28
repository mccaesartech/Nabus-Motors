import { NextRequest, NextResponse } from "next/server";
import { validateEmailForSignup } from "@/lib/email/validate-email-server";
import { consumeRateLimit, requestIp } from "@/lib/security/rate-limit";

/**
 * Server-side email checks for customer signup (format, disposable, MX).
 * Does not SMTP-probe mailboxes — see docs/EMAIL_VALIDATION.md.
 */
export async function POST(req: NextRequest) {
  let email = "";
  try {
    const body = await req.json();
    email = String(body.email ?? "");
  } catch {
    return NextResponse.json(
      { ok: false, code: "invalid_format", message: "Enter a valid email address." },
      { status: 400 }
    );
  }

  const rateLimit = consumeRateLimit(
    "customer-validate-email",
    requestIp(req.headers),
    { limit: 30, windowMs: 15 * 60_000 }
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "rate_limited",
        message: "Too many validation attempts. Please try again shortly.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  const result = await validateEmailForSignup(email);
  return NextResponse.json(
    {
      ok: result.ok,
      code: result.code,
      message: result.message,
      normalized: result.normalized,
    },
    { status: result.ok ? 200 : 400 }
  );
}
