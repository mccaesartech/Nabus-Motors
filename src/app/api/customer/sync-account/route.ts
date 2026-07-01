import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { isSessionPreference } from "@/lib/customer/session-preference";
import { syncCustomerAccount } from "@/lib/customer/preorder-account";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user?.email) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  let sessionPreference: string | undefined;
  try {
    const body = await req.json();
    sessionPreference = body?.sessionPreference;
  } catch {
    // Body optional — sync only
  }

  if (sessionPreference && isSessionPreference(sessionPreference)) {
    const supabase = createServerSupabase();
    if (supabase) {
      await supabase
        .from("profiles")
        .update({ session_preference: sessionPreference })
        .eq("id", user.id);
    }
  }

  const result = await syncCustomerAccount(user.id, user.email);
  return NextResponse.json({ ok: true, ...result });
}
