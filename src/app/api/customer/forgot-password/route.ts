import { NextRequest, NextResponse } from "next/server";
import {
  lookupCustomerAccount,
  sendCustomerPasswordReset,
} from "@/lib/customer/password-reset";
import { resolveWhatsAppPreferred } from "@/lib/notifications/customer-notify";
import { formatCustomerNotificationFeedback } from "@/lib/notifications/notification-status";
import { WHATSAPP_NUMBER, whatsappUrl } from "@/lib/constants";
import { createAdminSupabase } from "@/lib/supabase/admin";

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

    const account = await lookupCustomerAccount(identifier);

    if (!account?.email) {
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
      const ref = account.referenceCode ? ` Reference: ${account.referenceCode}.` : "";
      const supportWhatsApp = whatsappUrl(
        `Hi, I need help resetting my True Goshen password.${ref}`,
        WHATSAPP_NUMBER
      );

      if (result.error?.includes("Could not generate reset link")) {
        await logSkippedRecovery(
          account,
          "Customer record found but no auth.users account for password recovery"
        );
        return NextResponse.json({ ok: true, message: GENERIC_SUCCESS });
      }

      console.warn("[forgot-password] delivery failed:", {
        email: recoveryEmail,
        error: result.error,
        notification: result.notification,
      });

      return NextResponse.json({
        ok: true,
        message: `We found your account but couldn't deliver the reset email to ${recoveryEmail}. ${result.error ?? "Check spam or contact support."} If you're the site owner testing Resend, verify your domain at resend.com/domains — @resend.dev only delivers to the Resend account email.`,
        deliveryFailed: true,
        supportWhatsApp,
        emailAttempted: recoveryEmail,
        emailError: result.error ?? result.notification?.emailReason,
        channels: result.notification?.channels ?? [],
      });
    }

    const feedback = formatCustomerNotificationFeedback(result.notification, {
      savedPrefix: "Password reset link sent",
      recipientEmail: recoveryEmail,
    });

    const exactStatus = result.emailSent
      ? `Email sent to ${recoveryEmail}.`
      : feedback.message;

    return NextResponse.json({
      ok: true,
      message: `${GENERIC_SUCCESS} ${exactStatus}`,
      emailSent: result.emailSent,
      emailSentTo: recoveryEmail,
      whatsappSent: result.whatsappSent,
      emailDeliveryMethod: result.emailDeliveryMethod,
    });
  } catch (error) {
    console.error("[forgot-password] unexpected error:", error);
    return NextResponse.json(
      { ok: false, message: "Could not process request. Please try again." },
      { status: 500 }
    );
  }
}
