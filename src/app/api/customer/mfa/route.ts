import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/platform/password";
import {
  buildOtpAuthUri,
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateTotpSecret,
  otpAuthQrImageUrl,
  verifyTotpCode,
} from "@/lib/security/totp";
import { consumeRateLimit, requestIp } from "@/lib/security/rate-limit";
import { enqueueAuditLog } from "@/lib/audit/write";

export async function GET(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ ok: false, message: "Please sign in again." }, { status: 401 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ ok: true, enabled: false, enforced: false });
  }

  const { data } = await admin
    .from("customer_mfa_totp")
    .select("enabled_at, enforced_by_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    enabled: Boolean(data?.enabled_at),
    enforced: Boolean(data?.enforced_by_admin),
  });
}

/** Start MFA enrollment — returns secret + QR URL (not yet enabled). */
export async function POST(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ ok: false, message: "Please sign in again." }, { status: 401 });
  }

  const rate = consumeRateLimit("customer-mfa-setup", requestIp(req.headers), {
    limit: 10,
    windowMs: 60 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many MFA setup attempts. Try again later." },
      { status: 429 }
    );
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { ok: false, message: "Security settings are not available right now." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "enroll";

  if (action === "enroll") {
    const secret = generateTotpSecret();
    await admin.from("customer_mfa_totp").upsert({
      user_id: user.id,
      secret_encrypted: encryptSecret(secret),
      enabled_at: null,
      updated_at: new Date().toISOString(),
    });

    const otpauth = buildOtpAuthUri({
      secret,
      accountName: user.email ?? user.id,
    });

    return NextResponse.json({
      ok: true,
      secret,
      otpauth,
      qrUrl: otpAuthQrImageUrl(otpauth),
    });
  }

  if (action === "confirm") {
    const code = typeof body.code === "string" ? body.code : "";
    const { data } = await admin
      .from("customer_mfa_totp")
      .select("secret_encrypted")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!data?.secret_encrypted) {
      return NextResponse.json(
        { ok: false, message: "Start authenticator setup first." },
        { status: 400 }
      );
    }

    const secret = decryptSecret(data.secret_encrypted);
    if (!verifyTotpCode(secret, code)) {
      return NextResponse.json(
        { ok: false, message: "That code is incorrect. Check your authenticator and try again." },
        { status: 400 }
      );
    }

    const codes = generateBackupCodes(10);
    await admin.from("customer_mfa_backup_codes").delete().eq("user_id", user.id);
    await admin.from("customer_mfa_backup_codes").insert(
      await Promise.all(
        codes.map(async (code) => ({
          user_id: user.id,
          code_hash: await hashToken(code),
        }))
      )
    );

    await admin
      .from("customer_mfa_totp")
      .update({
        enabled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    enqueueAuditLog({
      action: "mfa_enabled",
      success: true,
      actorUserId: user.id,
      actorName: user.email ?? null,
      actorRole: "customer",
      targetType: "customer",
      targetId: user.id,
      request: req,
    });

    void import("@/lib/customer/security-notify")
      .then(({ notifyMfaChanged }) =>
        notifyMfaChanged({
          userId: user.id,
          email: user.email,
          enabled: true,
        })
      )
      .catch(() => {});

    return NextResponse.json({
      ok: true,
      backupCodes: codes,
      message: "Authenticator enabled. Store your backup codes in a safe place.",
    });
  }

  if (action === "disable") {
    const code = typeof body.code === "string" ? body.code : "";
    const { data } = await admin
      .from("customer_mfa_totp")
      .select("secret_encrypted, enforced_by_admin, enabled_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data?.enforced_by_admin) {
      return NextResponse.json(
        {
          ok: false,
          message: "An administrator requires MFA on this account. Contact support.",
        },
        { status: 403 }
      );
    }

    if (!data?.enabled_at || !data.secret_encrypted) {
      return NextResponse.json({ ok: true, message: "MFA is already off." });
    }

    const secret = decryptSecret(data.secret_encrypted);
    if (!verifyTotpCode(secret, code)) {
      return NextResponse.json(
        { ok: false, message: "Enter a valid authenticator code to turn MFA off." },
        { status: 400 }
      );
    }

    await admin
      .from("customer_mfa_totp")
      .update({ enabled_at: null, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    await admin.from("customer_mfa_backup_codes").delete().eq("user_id", user.id);

    enqueueAuditLog({
      action: "mfa_disabled",
      success: true,
      actorUserId: user.id,
      actorName: user.email ?? null,
      actorRole: "customer",
      targetType: "customer",
      targetId: user.id,
      request: req,
    });

    void import("@/lib/customer/security-notify")
      .then(({ notifyMfaChanged }) =>
        notifyMfaChanged({
          userId: user.id,
          email: user.email,
          enabled: false,
        })
      )
      .catch(() => {});

    return NextResponse.json({ ok: true, message: "Authenticator removed." });
  }

  return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 400 });
}
