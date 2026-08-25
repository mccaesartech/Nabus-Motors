import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/platform/password";
import { isPlatformInviteExpired } from "@/lib/platform/invite-ttl";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ ok: false, message: "Missing invite token." }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Server not configured." }, { status: 503 });
  }

  const tokenHash = await hashToken(token);
  const { data: invite, error } = await supabase
    .from("platform_user_invites")
    .select("id, user_id, expires_at, accepted_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !invite) {
    return NextResponse.json({ ok: false, message: "Invalid or expired invitation." }, { status: 404 });
  }

  if (invite.accepted_at) {
    return NextResponse.json({ ok: false, message: "This invitation was already used." }, { status: 410 });
  }

  if (isPlatformInviteExpired(invite.expires_at)) {
    return NextResponse.json({ ok: false, message: "This invitation has expired." }, { status: 410 });
  }

  const { data: user } = await supabase
    .from("platform_users")
    .select("name, email, role, status, password_hash")
    .eq("id", invite.user_id)
    .maybeSingle();

  if (!user || user.status === "disabled") {
    return NextResponse.json({ ok: false, message: "Invalid or expired invitation." }, { status: 404 });
  }

  if (user.status === "active") {
    return NextResponse.json(
      { ok: false, message: "This account is already active." },
      { status: 410 }
    );
  }

  return NextResponse.json({
    ok: true,
    invite: {
      name: user.name,
      email: user.email,
      role: user.role,
      hasTemporaryPassword: Boolean(user.password_hash),
    },
  });
}
