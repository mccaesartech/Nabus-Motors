import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, forbiddenOriginResponse } from "@/lib/security/csrf";
import { consumeRateLimitDurable, requestIp } from "@/lib/security/rate-limit";
import { enqueueAuditLog } from "@/lib/audit/write";
import {
  buildPlatformPasswordResetUrl,
  createPlatformPasswordResetToken,
  lookupActivePlatformUserByEmail,
  PLATFORM_PASSWORD_RESET_EXPIRY_LABEL,
} from "@/lib/platform/password-reset";
import { sendPlatformPasswordResetEmail } from "@/lib/email/platform-invite";
import { notifyTeamPasswordReset } from "@/lib/notifications/platform-team-whatsapp";

export const dynamic = "force-dynamic";

const GENERIC_SUCCESS =
  "If a team account exists for that email, we've sent password reset instructions.";

export async function POST(req: NextRequest) {
  if (!assertSameOrigin(req)) {
    return forbiddenOriginResponse();
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { ok: false, message: "Enter the email address for your team account." },
      { status: 400 }
    );
  }

  const ip = requestIp(req.headers);
  const rateLimit = await consumeRateLimitDurable(
    "admin-password-reset-request",
    `${ip}:${email}`,
    { limit: 5, windowMs: 15 * 60_000 }
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: true, message: GENERIC_SUCCESS },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  const user = await lookupActivePlatformUserByEmail(email);
  if (!user) {
    enqueueAuditLog({
      action: "password_reset_request",
      success: false,
      targetType: "platform_user",
      metadata: { accountFound: false, scope: "platform" },
      request: req,
    });
    return NextResponse.json({ ok: true, message: GENERIC_SUCCESS });
  }

  const created = await createPlatformPasswordResetToken({
    userId: user.id,
    requestedIp: ip,
  });

  if (!created.ok) {
    enqueueAuditLog({
      action: "password_reset_request",
      success: false,
      actorUserId: user.id,
      targetType: "platform_user",
      targetId: user.id,
      targetName: user.email,
      errorMessage: created.reason,
      metadata: { scope: "platform" },
      request: req,
    });
    // Anti-enumeration: same success copy even when schema/delivery is broken.
    return NextResponse.json({ ok: true, message: GENERIC_SUCCESS });
  }

  const resetUrl = buildPlatformPasswordResetUrl(created.token);
  const name = user.name?.trim() || "there";

  const emailResult = await sendPlatformPasswordResetEmail({
    to: user.email,
    name,
    resetUrl,
    expiryLabel: PLATFORM_PASSWORD_RESET_EXPIRY_LABEL,
  });

  void notifyTeamPasswordReset({
    phone: user.phone,
    name,
    resetUrl,
    expiryLabel: PLATFORM_PASSWORD_RESET_EXPIRY_LABEL,
    userId: user.id,
  }).catch(() => {});

  enqueueAuditLog({
    action: "password_reset_request",
    success: Boolean(emailResult.emailSent) || Boolean(user.phone?.trim()),
    actorUserId: user.id,
    targetType: "platform_user",
    targetId: user.id,
    targetName: user.email,
    metadata: {
      scope: "platform",
      emailSent: Boolean(emailResult.emailSent),
      hasPhone: Boolean(user.phone?.trim()),
    },
    request: req,
  });

  return NextResponse.json({ ok: true, message: GENERIC_SUCCESS });
}
