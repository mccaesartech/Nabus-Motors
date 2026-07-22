import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { hashPassword, verifyPassword } from "@/lib/platform/password";
import { logPlatformActivity } from "@/lib/platform/activity";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  if (auth.auth.type !== "user" || !auth.auth.userId) {
    return NextResponse.json(
      { ok: false, message: "Password change is only available for team accounts." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { ok: false, message: "Current and new password are required." },
      { status: 400 }
    );
  }

  if (newPassword.length < 10) {
    return NextResponse.json(
      { ok: false, message: "New password must be at least 10 characters." },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Database not configured." }, { status: 503 });
  }

  const { data: user, error } = await supabase
    .from("platform_users")
    .select("id, password_hash")
    .eq("id", auth.auth.userId)
    .maybeSingle();

  if (error || !user?.password_hash) {
    return NextResponse.json({ ok: false, message: "Account not found." }, { status: 404 });
  }

  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) {
    return NextResponse.json({ ok: false, message: "Current password is incorrect." }, { status: 401 });
  }

  const passwordHash = await hashPassword(newPassword);
  const { error: updateError } = await supabase
    .from("platform_users")
    .update({ password_hash: passwordHash })
    .eq("id", auth.auth.userId);

  if (updateError) {
    return NextResponse.json({ ok: false, message: updateError.message }, { status: 500 });
  }

  await logPlatformActivity(auth.auth, "user_updated", auth.auth.userId, {
    password_changed: true,
  });

  return NextResponse.json({
    ok: true,
    message: "Password updated. You will need to sign in again on other devices.",
  });
}
