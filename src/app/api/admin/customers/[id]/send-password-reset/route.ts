import { NextRequest, NextResponse } from "next/server";
import { apiFailure } from "@/lib/errors/api";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { canSendCustomerPasswordReset, requireAdmin } from "@/lib/admin/auth";
import { fetchAdminCustomerDetail } from "@/lib/platform/customers-admin";
import { sendCustomerPasswordReset } from "@/lib/customer/password-reset";
import { resolveWhatsAppPreferred } from "@/lib/notifications/customer-notify";
import { formatCustomerNotificationFeedback } from "@/lib/notifications/notification-status";
import { RESEND_DOMAIN_SETUP_URL } from "@/lib/email/delivery-health";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  if (!canSendCustomerPasswordReset(auth.auth)) {
    return NextResponse.json(
      { ok: false, message: "You do not have permission to send password reset links." },
      { status: 403 }
    );
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Not configured" }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, message: "Customer id is required." }, { status: 400 });
  }

  try {
    const customer = await fetchAdminCustomerDetail(supabase, id);
    if (!customer) {
      return NextResponse.json({ ok: false, message: "Customer not found." }, { status: 404 });
    }

    if (!customer.userId) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "This customer does not have a sign-in account yet. They can create one when submitting a quote or pre-order.",
        },
        { status: 400 }
      );
    }

    const referenceCode =
      customer.recentQuotes[0]?.referenceCode ??
      customer.registrationId ??
      customer.recentPreorders[0]?.referenceCode ??
      null;

    const result = await sendCustomerPasswordReset({
      email: customer.email,
      phone: customer.phone,
      whatsappPreferred: resolveWhatsAppPreferred(
        customer.phone ?? undefined,
        customer.whatsappOptIn ?? undefined
      ),
      customerName: customer.name,
      referenceCode,
      sourceTable: "profiles",
      sourceId: customer.userId,
    });

    if (!result.ok || !result.emailSent) {
      const emailDetail =
        result.error ??
        (result.notification?.emailReason
          ? `Email failed: ${result.notification.emailReason}`
          : "Could not send reset link. Check email configuration.");
      const setupHint = emailDetail.toLowerCase().includes("resend.dev")
        ? ` Verify your domain at ${RESEND_DOMAIN_SETUP_URL} or configure Supabase SMTP.`
        : "";
      return NextResponse.json(
        {
          ok: false,
          message: `${emailDetail}${setupHint}`,
          emailSent: false,
          whatsappSent: result.whatsappSent,
          notification: result.notification,
          resetUrl: result.resetUrl ?? null,
          recipientEmail: result.recipientEmail ?? customer.email,
          copyLinkFallback: Boolean(result.resetUrl),
        },
        { status: 502 }
      );
    }

    const feedback = formatCustomerNotificationFeedback(result.notification, {
      savedPrefix: "Password reset link sent",
      recipientEmail: result.recipientEmail ?? customer.email,
    });
    const suffix = " You never see the customer's password.";

    return NextResponse.json({
      ok: true,
      message: `${feedback.message}${suffix}`,
      notificationVariant: feedback.variant,
      emailSent: result.emailSent,
      whatsappSent: result.whatsappSent,
      notification: result.notification,
    });
  } catch (error) {
    return apiFailure(error, {
      module: "api.admin.customers.send-reset.POST",
      message: "Could not send password reset.",
      request: _req,
    });
  }
}
