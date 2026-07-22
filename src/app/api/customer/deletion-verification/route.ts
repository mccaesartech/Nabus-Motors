import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user?.email) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Verification is not available right now." },
      { status: 503 }
    );
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: user.email.trim().toLowerCase(),
    options: { shouldCreateUser: false },
  });

  if (error) {
    return NextResponse.json(
      { ok: false, message: "Could not send verification code. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "A verification code has been sent to your email.",
  });
}
