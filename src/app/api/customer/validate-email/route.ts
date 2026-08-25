import { NextRequest, NextResponse } from "next/server";
import { validateEmailForSignup } from "@/lib/email/validate-email-server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { consumeRateLimit, requestIp } from "@/lib/security/rate-limit";

/**
 * Server-side email checks for customer signup (format, disposable, MX).
 * Optional duplicate check against profiles (service role).
 * Does not SMTP-probe mailboxes — see docs/EMAIL_VALIDATION.md.
 */
export async function POST(req: NextRequest) {
  let email = "";
  let checkDuplicate = false;
  try {
    const body = await req.json();
    email = String(body.email ?? "");
    checkDuplicate = Boolean(body.checkDuplicate);
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
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: result.code,
        message: result.message,
        normalized: result.normalized,
      },
      { status: 400 }
    );
  }

  let duplicate = false;
  if (checkDuplicate && result.normalized) {
    const admin = createAdminSupabase();
    if (admin) {
      const { data } = await admin
        .from("profiles")
        .select("id")
        .ilike("email", result.normalized)
        .limit(1)
        .maybeSingle();
      duplicate = Boolean(data?.id);
    }
  }

  return NextResponse.json({
    ok: true,
    code: result.code,
    message: result.message,
    normalized: result.normalized,
    duplicate,
  });
}
