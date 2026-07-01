import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  canCopyCustomerPasswordResetLink,
  requireAdmin,
} from "@/lib/admin/auth";
import { fetchAdminCustomerDetail } from "@/lib/platform/customers-admin";
import { generateCustomerPasswordResetLink } from "@/lib/customer/password-reset";

type RouteContext = { params: Promise<{ id: string }> };

/** Generate a one-time reset link for manual delivery (WhatsApp). Never logs the full URL. */
export async function POST(_req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  if (!canCopyCustomerPasswordResetLink(auth.auth)) {
    return NextResponse.json(
      { ok: false, message: "Only owners and managers can copy password reset links." },
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

    const linkResult = await generateCustomerPasswordResetLink(customer.email, {
      sourceTable: "profiles",
      sourceId: customer.userId,
    });

    if ("error" in linkResult) {
      return NextResponse.json({ ok: false, message: linkResult.error }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      resetUrl: linkResult.resetUrl,
      recipientEmail: customer.email,
      message:
        "One-time reset link generated. It expires soon — send it to the customer via WhatsApp and do not share publicly.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate reset link.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
