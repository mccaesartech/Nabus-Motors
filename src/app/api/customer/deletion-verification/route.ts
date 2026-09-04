import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import {
  createCustomerReauthCode,
  getAccountLifecycleProfile,
  parseClientIp,
  sendCustomerReauthCodeEmail,
} from "@/lib/customer/account-lifecycle";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/security/rate-limit";

async function resolveCustomer(params: {
  userId?: string | null;
  email?: string | null;
}): Promise<{ userId: string; email: string; name?: string } | null> {
  const admin = createAdminSupabase();
  if (!admin) return null;

  if (params.userId) {
    const { data } = await admin
      .from("profiles")
      .select("id, email, first_name, last_name")
      .eq("id", params.userId)
      .maybeSingle();
    const email = data?.email?.trim().toLowerCase() || params.email?.trim().toLowerCase();
    if (data?.id && email) {
      const name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
      return { userId: data.id, email, name: name || undefined };
    }
  }

  const email = params.email?.trim().toLowerCase();
  if (!email) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, first_name, last_name")
    .ilike("email", email)
    .maybeSingle();

  if (profile?.id) {
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
    return {
      userId: profile.id,
      email: profile.email?.trim().toLowerCase() || email,
      name: name || undefined,
    };
  }

  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const authUser = list?.users?.find((u) => u.email?.toLowerCase() === email);
  if (authUser?.id) {
    return { userId: authUser.id, email: authUser.email ?? email };
  }

  return null;
}

export async function POST(req: NextRequest) {
  const authed = await getCustomerFromAuthHeader(req.headers.get("authorization"));

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const bodyEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const resolved = await resolveCustomer({
    userId: authed?.id,
    email: authed?.email ?? bodyEmail,
  });

  if (!resolved) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const ipAddress = parseClientIp(req) ?? "unknown";
  const ipRate = consumeRateLimit("customer-reauth-code-ip", ipAddress, {
    limit: 10,
    windowMs: 60 * 60_000,
  });
  if (!ipRate.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many verification requests. Please try again later." },
      { status: 429 }
    );
  }

  const userRate = consumeRateLimit("customer-reauth-code", resolved.userId, {
    limit: 5,
    windowMs: 60 * 60_000,
  });
  if (!userRate.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many verification requests. Please try again later." },
      { status: 429 }
    );
  }

  if (!authed) {
    const lifecycle = await getAccountLifecycleProfile(resolved.userId);
    if (lifecycle?.account_status !== "pending_deletion") {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
    if (bodyEmail && bodyEmail !== resolved.email) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
  }

  const created = await createCustomerReauthCode({
    userId: resolved.userId,
    purpose: "account_lifecycle",
    requestedIp: ipAddress,
  });

  if (!created.ok) {
    console.warn(
      JSON.stringify({
        event: "customer_reauth_code_send_failed",
        reason: created.reason,
      })
    );
    const message =
      created.reason === "schema_missing"
        ? "Verification is temporarily unavailable while the database finishes updating. Wait about 30 seconds and try again. If it keeps failing, ask support to run NOTIFY pgrst, 'reload schema';"
        : created.reason === "not_configured"
          ? "Verification is not available right now (server configuration)."
          : created.reason === "db_error"
            ? "Could not create a verification code (database error). Please try again."
            : "Could not send verification code. Please try again.";
    const status =
      created.reason === "schema_missing" || created.reason === "not_configured" ? 503 : 500;
    return NextResponse.json(
      { ok: false, message, reason: created.reason },
      { status }
    );
  }

  const sent = await sendCustomerReauthCodeEmail({
    to: resolved.email,
    name: resolved.name,
    code: created.code,
  });

  if (!sent.emailSent) {
    console.warn(
      JSON.stringify({
        event: "customer_reauth_code_email_failed",
        userId: resolved.userId,
        detail: sent.emailError?.slice(0, 500),
      })
    );
    return NextResponse.json(
      {
        ok: false,
        reason: "email_failed",
        message:
          sent.emailError ??
          "Could not send verification code email. Please try again in a moment.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: `A 6-digit verification code was sent to ${resolved.email}. Check inbox and spam (from noreply@nabusmotors.com).`,
  });
}