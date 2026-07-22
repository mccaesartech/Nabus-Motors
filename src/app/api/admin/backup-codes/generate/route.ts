import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { isWebAuthnEnabled } from "@/lib/admin/webauthn";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { generateToken, hashToken } from "@/lib/platform/password";

const BACKUP_CODE_COUNT = 10;

function formatBackupCode(): string {
  const token = generateToken().slice(0, 8).toUpperCase();
  return `${token.slice(0, 4)}-${token.slice(4, 8)}`;
}

export async function POST() {
  if (!isWebAuthnEnabled()) {
    return NextResponse.json({ ok: false, message: "Passkeys are not enabled." }, { status: 503 });
  }

  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  if (auth.auth.type !== "user" || !auth.auth.userId) {
    return NextResponse.json(
      { ok: false, message: "Backup codes are only available for team accounts." },
      { status: 403 }
    );
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Database not configured." }, { status: 503 });
  }

  await supabase
    .from("platform_user_backup_codes")
    .delete()
    .eq("platform_user_id", auth.auth.userId)
    .is("used_at", null);

  const plainCodes: string[] = [];
  const rows: { platform_user_id: string; code_hash: string }[] = [];

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = formatBackupCode();
    plainCodes.push(code);
    rows.push({
      platform_user_id: auth.auth.userId,
      code_hash: await hashToken(code.replace(/-/g, "").toLowerCase()),
    });
  }

  const { error } = await supabase.from("platform_user_backup_codes").insert(rows);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    codes: plainCodes,
    message: "Save these codes in a secure place. They will not be shown again.",
  });
}
