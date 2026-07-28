import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  PLATFORM_USER_COOKIE,
  adminDashboardPath,
  isAdminSessionSecretConfigured,
} from "@/lib/admin/config";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { hashPassword, hashToken } from "@/lib/platform/password";
import { isPlatformInviteExpired } from "@/lib/platform/invite-ttl";
import { logPlatformActivity } from "@/lib/platform/activity";
import { normalizeRole } from "@/lib/platform/permissions";
import {
  buildPlatformSessionCookieValue,
  PLATFORM_SESSION_TTL_SEC,
} from "@/lib/platform/session";
import { consumeRateLimit, requestIp } from "@/lib/security/rate-limit";
import { notifyTeamWelcomeWhatsApp } from "@/lib/notifications/platform-team-whatsapp";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const token = String(body.token ?? "").trim();
  const password = String(body.password ?? "");
  const phone = body.phone ? String(body.phone).trim() : null;
  const jobTitle = body.job_title ? String(body.job_title).trim() : null;

  if (!token || password.length < 8) {
    return NextResponse.json(
      { ok: false, message: "A valid token and password (8+ characters) are required." },
      { status: 400 }
    );
  }
  if (!isAdminSessionSecretConfigured()) {
    return NextResponse.json(
      { ok: false, message: "Server authentication is not configured." },
      { status: 503 }
    );
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Server not configured." }, { status: 503 });
  }

  const tokenHash = await hashToken(token);
  const rateLimit = consumeRateLimit(
    "admin-invite-accept",
    `${requestIp(req.headers)}:${tokenHash.slice(0, 16)}`,
    { limit: 5, windowMs: 15 * 60_000 }
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many activation attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  const { data: invite, error: inviteError } = await supabase
    .from("platform_user_invites")
    .select("id, user_id, expires_at, accepted_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (inviteError || !invite) {
    return NextResponse.json({ ok: false, message: "Invalid invitation." }, { status: 404 });
  }

  if (invite.accepted_at) {
    return NextResponse.json({ ok: false, message: "This invitation was already used." }, { status: 410 });
  }

  if (isPlatformInviteExpired(invite.expires_at)) {
    return NextResponse.json(
      { ok: false, message: "This invitation has expired. Ask your admin to send a new invite." },
      { status: 410 }
    );
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  const { data: user, error: userError } = await supabase
    .from("platform_users")
    .update({
      password_hash: passwordHash,
      status: "active",
      phone,
      job_title: jobTitle,
      activated_at: now,
      last_login_at: now,
    })
    .eq("id", invite.user_id)
    .select("id, name, email, role")
    .single();

  if (userError || !user) {
    return NextResponse.json({ ok: false, message: userError?.message ?? "Activation failed." }, { status: 500 });
  }

  const authContext = {
    type: "user" as const,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
  };

  await Promise.all([
    supabase.from("platform_user_invites").update({ accepted_at: now }).eq("id", invite.id),
    logPlatformActivity(authContext, "invite_accepted", user.email, {
      phone,
      job_title: jobTitle,
    }),
    logPlatformActivity(authContext, "login"),
  ]);

  notifyTeamWelcomeWhatsApp({
    phone,
    name: user.name,
    role: normalizeRole(user.role),
    userId: user.id,
  });

  const sessionValue = await buildPlatformSessionCookieValue(
    user.id,
    normalizeRole(user.role),
    passwordHash
  );
  const res = NextResponse.json({
    ok: true,
    message: "Account activated. Redirecting to your dashboard…",
    redirect: adminDashboardPath(),
  });

  res.cookies.set(PLATFORM_USER_COOKIE, sessionValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PLATFORM_SESSION_TTL_SEC,
  });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });

  return res;
}
