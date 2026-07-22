import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import {
  cancelCustomerAccountDeletion,
  getAccountLifecycleProfile,
  parseClientIp,
  restoreCustomerLogin,
  verifyCustomerReauth,
} from "@/lib/customer/account-lifecycle";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { notifyCustomer } from "@/lib/notifications/customer-notify";

async function resolveUserFromBody(body: Record<string, unknown>, authHeader: string | null) {
  const authed = await getCustomerFromAuthHeader(authHeader);
  if (authed?.email) {
    return { user: authed, email: authed.email };
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return null;

  const admin = createAdminSupabase();
  if (!admin) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (!profile?.id) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    const authUser = list?.users?.find((u) => u.email?.toLowerCase() === email);
    if (!authUser) return null;
    return { user: { id: authUser.id, email: authUser.email ?? email } as { id: string; email: string }, email };
  }

  return { user: { id: profile.id, email }, email };
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const resolved = await resolveUserFromBody(body, req.headers.get("authorization"));
  if (!resolved) {
    return NextResponse.json({ ok: false, message: "Account not found." }, { status: 404 });
  }

  const { user, email } = resolved;
  const password = typeof body.password === "string" ? body.password : undefined;
  const verificationToken =
    typeof body.verificationToken === "string" ? body.verificationToken : undefined;

  const lifecycle = await getAccountLifecycleProfile(user.id);
  if (lifecycle?.account_status !== "pending_deletion") {
    return NextResponse.json(
      { ok: false, message: "This account does not have a pending deletion request." },
      { status: 400 }
    );
  }

  const reauth = await verifyCustomerReauth({
    email,
    password,
    verificationToken,
    allowBanned: true,
  });
  if (!reauth.ok) {
    return NextResponse.json({ ok: false, message: reauth.message }, { status: 401 });
  }

  const result = await cancelCustomerAccountDeletion({
    userId: user.id,
    ipAddress: parseClientIp(req),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }

  await restoreCustomerLogin(user.id);

  const admin = createAdminSupabase();
  const { data: profile } = admin
    ? await admin
        .from("profiles")
        .select("phone, first_name, last_name")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const customerName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    email.split("@")[0];

  await notifyCustomer({
    email,
    phone: profile?.phone ?? null,
    customerName,
    template: "account_deletion_cancelled",
    sourceTable: "profiles",
    sourceId: user.id,
  });

  return NextResponse.json({ ok: true });
}
