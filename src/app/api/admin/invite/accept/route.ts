import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  PLATFORM_USER_COOKIE,
  adminDashboardPath,
  isAdminSessionSecretConfigured,
} from "@/lib/admin/config";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { hashToken, verifyPassword } from "@/lib/platform/password";
import { prepareAdminSetPassword } from "@/lib/platform/password-change";
import { isPlatformInviteExpired } from "@/lib/platform/invite-ttl";
import { logPlatformActivity } from "@/lib/platform/activity";
import { normalizeRole } from "@/lib/platform/permissions";
import {
  buildPlatformSessionCookieValue,
  PLATFORM_SESSION_TTL_SEC,
} from "@/lib/platform/session";
import { consumeRateLimitDurable, requestIp } from "@/lib/security/rate-limit";
import { assertSameOrigin, forbiddenOriginResponse } from "@/lib/security/csrf";
import { notifyTeamWelcomeWhatsApp } from "@/lib/notifications/platform-team-whatsapp";
import { sendPlatformTeamWelcomeEmail } from "@/lib/email/platform-invite";
import { enqueueAuditLog } from "@/lib/audit/write";
import { platformForcedPasswordChangeRedirectUrl } from "@/lib/platform/paths";
import { isSchemaMissing, SCHEMA_CAPS } from "@/lib/observability/schema-capability";

export async function POST(req: NextRequest) {
  if (!assertSameOrigin(req)) {
    return forbiddenOriginResponse();
  }

  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "").trim();
  const password = String(body.password ?? "");
  const phone = body.phone ? String(body.phone).trim() : null;
  const jobTitle = body.job_title ? String(body.job_title).trim() : null;

  if (!token || !password) {
    return NextResponse.json(
      { ok: false, message: "A valid invitation token and password are required." },
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
  const rateLimit = await consumeRateLimitDurable(
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
    enqueueAuditLog({
      action: "invitation_accepted",
      success: false,
      targetType: "platform_invite",
      errorMessage: "invalid_invitation",
      request: req,
    });
    return NextResponse.json({ ok: false, message: "Invalid invitation." }, { status: 404 });
  }

  if (invite.accepted_at) {
    enqueueAuditLog({
      action: "invitation_accepted",
      success: false,
      targetType: "platform_invite",
      targetId: invite.id,
      errorMessage: "already_used",
      request: req,
    });
    return NextResponse.json({ ok: false, message: "This invitation was already used." }, { status: 410 });
  }

  if (isPlatformInviteExpired(invite.expires_at)) {
    enqueueAuditLog({
      action: "invitation_accepted",
      success: false,
      targetType: "platform_invite",
      targetId: invite.id,
      errorMessage: "expired",
      request: req,
    });
    return NextResponse.json(
      { ok: false, message: "This invitation has expired. Ask your admin to send a new invite." },
      { status: 410 }
    );
  }

  const { data: pendingUser } = await supabase
    .from("platform_users")
    .select("id, status, password_hash")
    .eq("id", invite.user_id)
    .maybeSingle();

  if (!pendingUser || pendingUser.status === "disabled") {
    enqueueAuditLog({
      action: "invitation_accepted",
      success: false,
      targetType: "platform_invite",
      targetId: invite.id,
      errorMessage: "invalid_invitation",
      request: req,
    });
    return NextResponse.json({ ok: false, message: "Invalid invitation." }, { status: 404 });
  }
  if (pendingUser.status === "active") {
    enqueueAuditLog({
      action: "invitation_accepted",
      success: false,
      targetType: "platform_user",
      targetId: invite.user_id,
      errorMessage: "already_active",
      request: req,
    });
    return NextResponse.json({ ok: false, message: "This account is already active." }, { status: 410 });
  }

  const now = new Date().toISOString();
  let sessionPasswordHash: string;
  const adminAssignedPassword = Boolean(pendingUser.password_hash);

  if (pendingUser.password_hash) {
    // Admin-assigned temp password: verify on the invite page; do not replace hash.
    const matches = await verifyPassword(password, pendingUser.password_hash);
    if (!matches) {
      enqueueAuditLog({
        action: "invitation_accepted",
        success: false,
        targetType: "platform_user",
        targetId: invite.user_id,
        errorMessage: "temp_password_mismatch",
        request: req,
      });
      return NextResponse.json(
        {
          ok: false,
          message:
            "That password does not match the temporary password from your invite email. Try again or ask the owner to resend credentials.",
        },
        { status: 401 }
      );
    }
    sessionPasswordHash = pendingUser.password_hash;
  } else {
    const prepared = await prepareAdminSetPassword(password);
    if (!prepared.ok) {
      return NextResponse.json(
        { ok: false, message: prepared.message },
        { status: prepared.status }
      );
    }
    sessionPasswordHash = prepared.passwordHash;
  }

  // Atomic claim: only the first acceptor wins.
  const { data: claimed, error: claimError } = await supabase
    .from("platform_user_invites")
    .update({ accepted_at: now })
    .eq("id", invite.id)
    .is("accepted_at", null)
    .select("id")
    .maybeSingle();

  if (claimError || !claimed) {
    enqueueAuditLog({
      action: "invitation_accepted",
      success: false,
      targetType: "platform_invite",
      targetId: invite.id,
      errorMessage: "already_used",
      request: req,
    });
    return NextResponse.json(
      { ok: false, message: "This invitation was already used." },
      { status: 410 }
    );
  }

  const userUpdates: Record<string, unknown> = {
    status: "active",
    phone,
    job_title: jobTitle,
    activated_at: now,
    last_login_at: now,
  };
  if (!pendingUser.password_hash) {
    userUpdates.password_hash = sessionPasswordHash;
  }
  if (
    adminAssignedPassword &&
    !isSchemaMissing(SCHEMA_CAPS.platformUsersMustChangePassword)
  ) {
    userUpdates.must_change_password = true;
  }

  const { data: user, error: userError } = await supabase
    .from("platform_users")
    .update(userUpdates)
    .eq("id", invite.user_id)
    .select("id, name, email, role")
    .single();

  if (userError || !user) {
    // Roll back invite claim so the user can retry.
    await supabase
      .from("platform_user_invites")
      .update({ accepted_at: null })
      .eq("id", invite.id);
    enqueueAuditLog({
      action: "invitation_accepted",
      success: false,
      targetType: "platform_user",
      targetId: invite.user_id,
      errorMessage: "activation_failed",
      request: req,
    });
    return NextResponse.json(
      { ok: false, message: userError?.message ?? "Activation failed." },
      { status: 500 }
    );
  }

  const authContext = {
    type: "user" as const,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
  };

  await Promise.all([
    logPlatformActivity(authContext, "invite_accepted", user.email, {
      phone,
      job_title: jobTitle,
    }),
    logPlatformActivity(authContext, "login"),
  ]);

  enqueueAuditLog({
    action: "invitation_accepted",
    success: true,
    actor: authContext,
    targetType: "platform_user",
    targetId: user.id,
    targetName: user.email,
    request: req,
  });
  enqueueAuditLog({
    action: "login",
    success: true,
    actor: authContext,
    targetType: "platform_session",
    request: req,
  });

  notifyTeamWelcomeWhatsApp({
    phone,
    name: user.name,
    role: normalizeRole(user.role),
    userId: user.id,
  });

  if (user.email?.trim()) {
    void sendPlatformTeamWelcomeEmail({
      to: user.email.trim(),
      name: user.name,
      role: normalizeRole(user.role),
    }).catch((err) => {
      console.warn(
        "[invite/accept] welcome email failed (non-blocking):",
        err instanceof Error ? err.message : err
      );
    });
  }

  const mustChangePassword =
    adminAssignedPassword &&
    !isSchemaMissing(SCHEMA_CAPS.platformUsersMustChangePassword);
  const sessionValue = await buildPlatformSessionCookieValue(
    user.id,
    normalizeRole(user.role),
    sessionPasswordHash,
    { mustChangePassword }
  );
  const res = NextResponse.json({
    ok: true,
    message: mustChangePassword
      ? "Account activated. Set a new password to continue."
      : "Account activated. Redirecting to your dashboard…",
    redirect: mustChangePassword
      ? platformForcedPasswordChangeRedirectUrl()
      : adminDashboardPath(),
    mustChangePassword,
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
