import { NextRequest, NextResponse } from "next/server";
import { buildPlatformLoginResponse } from "@/lib/admin/platform-login";
import {
  clientIp,
  isPasskeyRateLimited,
  passkeyRateLimitMessage,
} from "@/lib/admin/passkey-rate-limit";
import { isWebAuthnEnabled } from "@/lib/admin/webauthn";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/platform/password";
import { schedulePlatformFailedLoginAlert } from "@/lib/notifications/platform-login-notify";

export async function POST(req: NextRequest) {
  if (!isWebAuthnEnabled()) {
    return NextResponse.json({ ok: false, message: "Passkeys are not enabled." }, { status: 503 });
  }

  if (isPasskeyRateLimited(clientIp(req))) {
    return NextResponse.json({ ok: false, message: passkeyRateLimitMessage() }, { status: 429 });
  }

  const body = await req.json();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!email || !code) {
    return NextResponse.json(
      { ok: false, message: "Email and backup code are required." },
      { status: 400 }
    );
  }

  const normalizedCode = code.replace(/-/g, "").toLowerCase();
  if (normalizedCode.length < 8) {
    return NextResponse.json({ ok: false, message: "Invalid backup code." }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Database not configured." }, { status: 503 });
  }

  const { data: user } = await supabase
    .from("platform_users")
    .select("id, name, email, role, status, password_hash, phone")
    .eq("email", email)
    .maybeSingle();

  if (!user || user.status !== "active" || !user.password_hash) {
    if (email) {
      schedulePlatformFailedLoginAlert({
        email,
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
      });
    }
    return NextResponse.json({ ok: false, message: "Invalid email or backup code." }, { status: 401 });
  }

  const codeHash = await hashToken(normalizedCode);
  const { data: backupRow } = await supabase
    .from("platform_user_backup_codes")
    .select("id")
    .eq("platform_user_id", user.id)
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .maybeSingle();

  if (!backupRow) {
    schedulePlatformFailedLoginAlert({
      email,
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: false, message: "Invalid email or backup code." }, { status: 401 });
  }

  const now = new Date().toISOString();
  await supabase
    .from("platform_user_backup_codes")
    .update({ used_at: now })
    .eq("id", backupRow.id);

  await supabase.from("platform_users").update({ last_login_at: now }).eq("id", user.id);

  return buildPlatformLoginResponse(user);
}
