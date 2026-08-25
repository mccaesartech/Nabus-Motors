import { NextRequest, NextResponse } from "next/server";
import {
  lookupCustomerAccount,
  sendCustomerPasswordReset,
} from "@/lib/customer/password-reset";
import { resolveWhatsAppPreferred } from "@/lib/notifications/customer-notify";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { consumeRateLimitDurable, requestIp } from "@/lib/security/rate-limit";
import { assertSameOrigin, forbiddenOriginResponse } from "@/lib/security/csrf";
import { enqueueAuditLog } from "@/lib/audit/write";

const GENERIC_SUCCESS =
  "If an account exists with that email or phone, we've sent password reset instructions.";

async function logSkippedRecovery(
  account: NonNullable<Awaited<ReturnType<typeof lookupCustomerAccount>>>,
  detail: string
) {
  const supabase = createAdminSupabase();
  if (!supabase) return;

  try {
    await supabase.from("notification_log").insert({
      source_table: account.sourceTable,
      source_id: account.sourceId,
      template: "password_reset",
      channel: "email",
      status: "skipped",
      recipient: account.email,
      detail,
    });
  } catch {
    // Non-blocking
  }
}

export async function POST(req: NextRequest) {
  if (!assertSameOrigin(req)) {
    return forbiddenOriginResponse();
  }

  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();

    const identifier = email || phone;
    if (!identifier) {
      return NextResponse.json(
        { ok: false, message: "Enter your email or phone number." },
        { status: 400 }
      );
    }

    const rateLimit = await consumeRateLimitDurable(
      "customer-password-reset",
      `${requestIp(req.headers)}:${identifier.toLowerCase()}`,
      { limit: 5, windowMs: 15 * 60_000 }
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { ok: true, message: GENERIC_SUCCESS },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const account = await lookupCustomerAccount(identifier);

    if (!account?.email) {
      enqueueAuditLog({
        action: "password_reset_request",
        success: false,
        metadata: { accountFound: false },
        request: req,
      });
      return NextResponse.json({ ok: true, message: GENERIC_SUCCESS });
    }

    const recoveryEmail = account.email.trim().toLowerCase();
    const whatsappPreferred = resolveWhatsAppPreferred(
      account.phone ?? undefined,
      account.whatsappOptIn ?? undefined
    );

    const result = await sendCustomerPasswordReset({
      email: recoveryEmail,
      phone: account.phone,
      whatsappPreferred,
      customerName: account.customerName,
      referenceCode: account.referenceCode,
      sourceTable: account.sourceTable,
      sourceId: account.userId ?? account.sourceId,
    });

    if (!result.ok) {
      enqueueAuditLog({
        action: "password_reset_request",
        success: false,
        actorUserId: account.userId,
        metadata: { accountFound: true },
        request: req,
      });
      if (result.error?.includes("Could not generate reset link")) {
        await logSkippedRecovery(
          account,
          "Customer record found but no auth.users account for password recovery"
        );
        return NextResponse.json({ ok: true, message: GENERIC_SUCCESS });
      }

      console.warn("[forgot-password] delivery failed; account and provider detail omitted");
      return NextResponse.json({ ok: true, message: GENERIC_SUCCESS });
    }

    enqueueAuditLog({
      action: "password_reset_request",
      success: true,
      actorUserId: account.userId,
      metadata: { accountFound: true },
      request: req,
    });
    return NextResponse.json({ ok: true, message: GENERIC_SUCCESS });
  } catch {
    console.error("[forgot-password] unexpected error; request detail omitted");
    return NextResponse.json(
      { ok: false, message: "Could not process request. Please try again." },
      { status: 500 }
    );
  }
}
