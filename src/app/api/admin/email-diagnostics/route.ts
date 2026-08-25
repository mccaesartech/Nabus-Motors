import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/auth";
import { withApiErrorHandling } from "@/lib/errors/api";
import { inspectResendConfiguration } from "@/lib/email/resend-diagnostics";

/**
 * Reports which Resend domains the API key on *this* deployment can see.
 *
 * Vercel keeps a separate RESEND_API_KEY per environment and bakes it in at
 * build time, so the only trustworthy answer comes from the running deployment
 * itself. Reads the provider live and depends on the admin session, so it must
 * never be prerendered or cached.
 */
export const dynamic = "force-dynamic";

export const GET = withApiErrorHandling(
  "api.admin.email-diagnostics.GET",
  async () => {
    const auth = await requirePermission("settings");
    if (!auth.ok) {
      return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
    }

    return NextResponse.json({ ok: true, diagnostics: await inspectResendConfiguration() });
  },
  "Email configuration could not be checked. Try again."
);
