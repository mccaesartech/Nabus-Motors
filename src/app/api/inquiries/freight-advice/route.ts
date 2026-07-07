import { NextRequest } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { sendFreightAdviceMessage } from "@/lib/customer/freight-advice-message";
import { jsonError, jsonOk } from "@/lib/inquiries/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messageBody = String(body.body ?? "").trim();

    if (!messageBody) {
      return jsonError("Message is required.", 400);
    }

    const admin = createAdminSupabase();
    if (!admin) {
      return jsonError("Messaging is not configured yet.", 503);
    }

    const authUser = await getCustomerFromAuthHeader(req.headers.get("authorization"));

    const result = await sendFreightAdviceMessage(admin, {
      userId: authUser?.id,
      name: authUser ? undefined : String(body.name ?? "").trim(),
      email: authUser ? undefined : String(body.email ?? "").trim(),
      phone: authUser ? undefined : String(body.phone ?? "").trim() || undefined,
      body: messageBody,
      context: {
        trackingNumber: body.trackingNumber
          ? String(body.trackingNumber).trim()
          : undefined,
        referenceCode: body.referenceCode
          ? String(body.referenceCode).trim()
          : undefined,
      },
    });

    if (!result.ok) {
      return jsonError(result.error, result.status ?? 500);
    }

    return jsonOk(
      "Your message was sent. Our freight team will reply in your account messages.",
      {
        conversationId: result.conversationId,
        accountMessagesUrl: `/account?conversation=${result.conversationId}#messages`,
      }
    );
  } catch {
    return jsonError("Invalid request.", 400);
  }
}
