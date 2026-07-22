import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import {
  checkDeletionRateLimit,
  getAccountLifecycleProfile,
  getAccountRetentionDays,
  parseClientIp,
  recordDeletionAttempt,
  verifyCustomerReauth,
} from "@/lib/customer/account-lifecycle";
import {
  isValidDeleteConfirmation,
  isValidDeletionReason,
} from "@/lib/customer/account-lifecycle.validation";
import { initiateAccountDeletion } from "@/lib/customer/delete-account";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const lifecycle = await getAccountLifecycleProfile(user.id);
  return NextResponse.json({
    ok: true,
    retentionDays: getAccountRetentionDays(),
    lifecycle,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
  if (!user?.email) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Account deletion is not available right now." },
      { status: 503 }
    );
  }

  const ipAddress = parseClientIp(req);

  const rateCheck = await checkDeletionRateLimit(supabase, user.id);
  if (!rateCheck.allowed) {
    return NextResponse.json({ ok: false, message: rateCheck.message }, { status: 429 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid request body." },
      { status: 400 }
    );
  }

  const confirmation = typeof body.confirmation === "string" ? body.confirmation : "";
  const password = typeof body.password === "string" ? body.password : undefined;
  const verificationToken =
    typeof body.verificationToken === "string" ? body.verificationToken : undefined;
  const reason = typeof body.reason === "string" ? body.reason : undefined;
  const feedbackText =
    typeof body.feedbackText === "string" ? body.feedbackText.trim() : undefined;

  if (!isValidDeleteConfirmation(confirmation, user.email)) {
    await recordDeletionAttempt(supabase, user.id, ipAddress, false);
    return NextResponse.json(
      {
        ok: false,
        message: 'Type your email address or "DELETE" to confirm account deletion.',
      },
      { status: 400 }
    );
  }

  const reauth = await verifyCustomerReauth({
    email: user.email,
    password,
    verificationToken,
  });
  if (!reauth.ok) {
    await recordDeletionAttempt(supabase, user.id, ipAddress, false);
    return NextResponse.json({ ok: false, message: reauth.message }, { status: 401 });
  }

  if (reason && !isValidDeletionReason(reason)) {
    return NextResponse.json({ ok: false, message: "Invalid deletion reason." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  const customerName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    user.email.split("@")[0];

  const feedback =
    reason || feedbackText
      ? {
          reason: reason ?? null,
          text: feedbackText ?? null,
        }
      : null;

  const result = await initiateAccountDeletion({
    supabase,
    userId: user.id,
    email: user.email,
    phone: profile?.phone ?? null,
    customerName,
    reason: reason ?? null,
    feedback,
    ipAddress,
  });

  await recordDeletionAttempt(supabase, user.id, ipAddress, result.ok);

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    retentionExpiresAt: result.retentionExpiresAt,
    scheduledDeletionAt: result.scheduledDeletionAt,
    retentionDays: getAccountRetentionDays(),
  });
}
