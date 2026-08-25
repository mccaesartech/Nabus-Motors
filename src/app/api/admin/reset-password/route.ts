import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, forbiddenOriginResponse } from "@/lib/security/csrf";
import { consumeRateLimitDurable, requestIp } from "@/lib/security/rate-limit";
import { enqueueAuditLog } from "@/lib/audit/write";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { prepareAdminSetPassword } from "@/lib/platform/password-change";
import { verifyPassword } from "@/lib/platform/password";
import {
  consumePlatformPasswordResetToken,
  validatePlatformPasswordResetToken,
} from "@/lib/platform/password-reset";
import { logPlatformActivity } from "@/lib/platform/activity";
import { getPublicSiteUrl } from "@/lib/site-url";
import { platformPath } from "@/lib/platform/paths";
import { sendPlatformPasswordChangedEmail } from "@/lib/email/platform-invite";
import { notifyTeamPasswordChanged } from "@/lib/notifications/platform-team-whatsapp";
import { isSchemaMissing, SCHEMA_CAPS } from "@/lib/observability/schema-capability";
import type { PlatformAuthContext } from "@/lib/admin/auth";
import type { PlatformRole } from "@/lib/platform/permissions";

export const dynamic = "force-dynamic";

function messageForValidateReason(reason: string): string {
  switch (reason) {
    case "used":
      return "This reset link was already used. Request a new one.";
    case "expired":
      return "This reset link has expired. Request a new one.";
    case "schema_missing":
    case "not_configured":
      return "Password reset is temporarily unavailable. Contact an owner.";
    default:
      return "Invalid or expired reset link.";
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ ok: false, message: "Reset token is required." }, { status: 400 });
  }

  const rateLimit = await consumeRateLimitDurable(
    "admin-password-reset-validate",
    `${requestIp(req.headers)}:${token.slice(0, 16)}`,
    { limit: 20, windowMs: 15 * 60_000 }
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  const validated = await validatePlatformPasswordResetToken(token);
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, message: messageForValidateReason(validated.reason) },
      { status: validated.reason === "expired" || validated.reason === "used" ? 410 : 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    emailHint: maskEmail(validated.row.email),
  });
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "team member";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export async function POST(req: NextRequest) {
  if (!assertSameOrigin(req)) {
    return forbiddenOriginResponse();
  }

  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "").trim();
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword =
    typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (!token) {
    return NextResponse.json({ ok: false, message: "Reset token is required." }, { status: 400 });
  }

  if (password !== confirmPassword) {
    return NextResponse.json(
      { ok: false, message: "Passwords do not match." },
      { status: 400 }
    );
  }

  const rateLimit = await consumeRateLimitDurable(
    "admin-password-reset-complete",
    `${requestIp(req.headers)}:${token.slice(0, 16)}`,
    { limit: 5, windowMs: 15 * 60_000 }
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  const prepared = await prepareAdminSetPassword(password);
  if (!prepared.ok) {
    return NextResponse.json(
      { ok: false, message: prepared.message },
      { status: prepared.status }
    );
  }

  const validated = await validatePlatformPasswordResetToken(token);
  if (!validated.ok) {
    enqueueAuditLog({
      action: "password_changed",
      success: false,
      targetType: "platform_user",
      errorMessage: validated.reason,
      metadata: { scope: "platform", via: "reset_token" },
      request: req,
    });
    return NextResponse.json(
      { ok: false, message: messageForValidateReason(validated.reason) },
      { status: validated.reason === "expired" || validated.reason === "used" ? 410 : 400 }
    );
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Server not configured." }, { status: 503 });
  }

  const { data: currentUser } = await supabase
    .from("platform_users")
    .select("id, password_hash")
    .eq("id", validated.row.userId)
    .maybeSingle();

  if (currentUser?.password_hash) {
    const sameAsOld = await verifyPassword(password, currentUser.password_hash);
    if (sameAsOld) {
      return NextResponse.json(
        { ok: false, message: "New password must be different from your current password." },
        { status: 400 }
      );
    }
  }

  const resetUpdate: Record<string, unknown> = {
    password_hash: prepared.passwordHash,
  };
  if (!isSchemaMissing(SCHEMA_CAPS.platformUsersMustChangePassword)) {
    resetUpdate.must_change_password = false;
  }

  const { data: updated, error: updateError } = await supabase
    .from("platform_users")
    .update(resetUpdate)
    .eq("id", validated.row.userId)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (updateError || !updated?.id) {
    enqueueAuditLog({
      action: "password_changed",
      success: false,
      actorUserId: validated.row.userId,
      targetType: "platform_user",
      targetId: validated.row.userId,
      targetName: validated.row.email,
      errorMessage: updateError?.message ?? "update_failed",
      metadata: { scope: "platform", via: "reset_token" },
      request: req,
    });
    return NextResponse.json(
      { ok: false, message: "Could not save the new password. Try again." },
      { status: 500 }
    );
  }

  const consumed = await consumePlatformPasswordResetToken(token);
  if (!consumed.ok) {
    // Password already saved — treat as success even if token mark-used races.
    console.warn("[admin/reset-password] token consume after update:", consumed.reason);
  }

  const actor: PlatformAuthContext = {
    type: "user",
    userId: validated.row.userId,
    email: validated.row.email,
    name: validated.row.name ?? "Team member",
    role: validated.row.role as PlatformRole,
  };

  await logPlatformActivity(actor, "user_updated", validated.row.userId, {
    password_changed: true,
    via: "reset_token",
  });

  enqueueAuditLog({
    action: "password_changed",
    success: true,
    actorUserId: validated.row.userId,
    targetType: "platform_user",
    targetId: validated.row.userId,
    targetName: validated.row.email,
    metadata: { scope: "platform", via: "reset_token" },
    request: req,
  });

  const when = new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const ip = requestIp(req.headers);
  const securityUrl = `${getPublicSiteUrl()}${platformPath("account/security")}`;

  if (validated.row.email?.trim()) {
    void sendPlatformPasswordChangedEmail({
      to: validated.row.email.trim(),
      name: validated.row.name || "there",
      when,
      ip,
      securityUrl,
    }).catch(() => {});
  }
  void notifyTeamPasswordChanged({
    phone: validated.row.phone,
    name: validated.row.name || "there",
    when,
    ip,
    securityUrl,
    userId: validated.row.userId,
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    message: "Password updated. You can sign in with your new password.",
  });
}