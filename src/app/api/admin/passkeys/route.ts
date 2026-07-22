import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { isWebAuthnEnabled, listUserPasskeys, countUnusedBackupCodes } from "@/lib/admin/webauthn";

export async function GET() {
  if (!isWebAuthnEnabled()) {
    return NextResponse.json({ ok: true, enabled: false, passkeys: [], backupCodesRemaining: 0 });
  }

  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  if (auth.auth.type !== "user" || !auth.auth.userId) {
    return NextResponse.json({
      ok: true,
      enabled: true,
      passkeys: [],
      backupCodesRemaining: 0,
      ownerAccount: true,
    });
  }

  const [passkeys, backupCodesRemaining] = await Promise.all([
    listUserPasskeys(auth.auth.userId),
    countUnusedBackupCodes(auth.auth.userId),
  ]);

  return NextResponse.json({
    ok: true,
    enabled: true,
    passkeys,
    backupCodesRemaining,
    canManagePasskeys: true,
  });
}
