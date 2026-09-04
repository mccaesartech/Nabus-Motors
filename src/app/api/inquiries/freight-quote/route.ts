import { NextRequest } from "next/server";
import { insertRow, jsonError, jsonOk } from "@/lib/inquiries/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import {
  linkCustomerFreightQuotesByEmail,
  resolvePreorderAccount,
} from "@/lib/customer/preorder-account";
import {
  isMissingTableError,
  notifyFreightQuoteRequest,
} from "@/lib/platform/inquiry-notifications";
import { generateFreightReferenceCode } from "@/lib/platform/freight-reference";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  notifyCustomer,
  resolveWhatsAppPreferred,
} from "@/lib/notifications/customer-notify";
import { generateCustomerPasswordResetLink } from "@/lib/customer/password-reset";

const VALID_SERVICE_TYPES = new Set([
  "vehicle_shipping",
  "container_shipping",
  "documentation",
  "clearing",
  "other",
]);

async function allocateReferenceCode(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateFreightReferenceCode();
    const { data } = await admin
      .from("freight_quote_requests")
      .select("id")
      .eq("reference_code", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return generateFreightReferenceCode();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      phone,
      serviceType,
      originCountry,
      cargoDescription,
      cargoSize,
      message,
      estimatedValueUsd,
      password,
      whatsappOptIn,
    } = body;

    const trimmedName = String(name ?? "").trim();
    const trimmedEmail = String(email ?? "").trim();
    const trimmedPhone = String(phone ?? "").trim();

    if (!trimmedName || !trimmedEmail) {
      return jsonError("Name and email are required.", 400);
    }

    if (!trimmedPhone) {
      return jsonError("Phone number is required.", 400);
    }

    const trimmedCargoDescription = String(cargoDescription ?? "").trim();
    if (!trimmedCargoDescription) {
      return jsonError("Cargo description is required.", 400);
    }
    const trimmedCargoSize = cargoSize ? String(cargoSize).trim() : null;

    const service = String(serviceType ?? "vehicle_shipping");
    if (!VALID_SERVICE_TYPES.has(service)) {
      return jsonError("Invalid service type.", 400);
    }

    const authUser = await getCustomerFromAuthHeader(req.headers.get("authorization"));

    if (!authUser && !String(password ?? "").trim()) {
      return jsonError(
        "Password is required to create your account and track quotes and shipments.",
        400
      );
    }

    const account = await resolvePreorderAccount({
      authUser,
      email: trimmedEmail,
      name: trimmedName,
      phone: trimmedPhone,
      password: authUser ? undefined : password,
    });

    if (account.error) {
      return jsonError(account.error, 400);
    }

    const userId = account.userId ?? authUser?.id ?? null;
    const registrationId = account.registrationId;

    const adminSupabase = createAdminSupabase();
    const referenceCode = adminSupabase
      ? await allocateReferenceCode(adminSupabase)
      : generateFreightReferenceCode();

    const whatsappPreferred = resolveWhatsAppPreferred(
      trimmedPhone,
      whatsappOptIn === true ? true : whatsappOptIn === false ? false : undefined
    );

    const result = await insertRow("freight_quote_requests", {
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      whatsapp_opt_in: whatsappPreferred,
      service_type: service,
      origin_country: originCountry ? String(originCountry).trim() : null,
      cargo_description: trimmedCargoDescription,
      cargo_size: trimmedCargoSize,
      estimated_value_usd: estimatedValueUsd ? Number(estimatedValueUsd) : null,
      message: message ? String(message).trim() : null,
      status: "new",
      source: "website",
      user_id: userId,
      customer_registration_id: registrationId,
      reference_code: referenceCode,
    });

    if (!result.ok) {
      console.error("[freight-quote] insert failed:", result.error);
      if (result.error && isMissingTableError(result.error, "freight_quote_requests")) {
        return jsonError(
          "Our quote system is temporarily unavailable. Please email us directly or call our office.",
          503
        );
      }
      return jsonError("Could not save your quote request. Please contact us directly.");
    }

    const inserted = result.data;

    if (inserted?.id && adminSupabase && !inserted.reference_code) {
      const { data: updated } = await adminSupabase
        .from("freight_quote_requests")
        .update({ reference_code: referenceCode })
        .eq("id", String(inserted.id))
        .select("reference_code")
        .maybeSingle();
      if (updated?.reference_code) {
        inserted.reference_code = updated.reference_code;
      }
    }

    if (userId) {
      await linkCustomerFreightQuotesByEmail(userId, trimmedEmail, registrationId);
    }

    const savedReference =
      (inserted?.reference_code as string | undefined) ?? referenceCode;

    if (inserted?.id && adminSupabase) {
      await notifyFreightQuoteRequest(adminSupabase, {
        id: String(inserted.id),
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        service_type: service,
        origin_country: originCountry ? String(originCountry).trim() : null,
        reference_code: savedReference,
        cargo_description: trimmedCargoDescription,
      });
    }

    const isConsultation = String(message ?? "").includes("[Shipping consultation]");
    const accountCreated = Boolean(userId && !authUser);

    let passwordResetUrl: string | undefined;
    if (accountCreated && trimmedEmail) {
      const linkResult = await generateCustomerPasswordResetLink(trimmedEmail);
      if ("resetUrl" in linkResult) {
        passwordResetUrl = linkResult.resetUrl;
      }
    }

    await notifyCustomer({
      email: trimmedEmail,
      phone: trimmedPhone,
      whatsappPreferred,
      customerName: trimmedName,
      template: isConsultation ? "shipping_consultation_submitted" : "freight_quote_submitted",
      data: {
        referenceCode: savedReference,
        passwordResetUrl,
      },
      sourceTable: "freight_quote_requests",
      sourceId: inserted?.id ? String(inserted.id) : undefined,
    });

    let trackingNumber: string | null = null;
    if (inserted?.converted_shipment_id && adminSupabase) {
      const { data: shipment } = await adminSupabase
        .from("shipment_tracking")
        .select("tracking_number")
        .eq("id", String(inserted.converted_shipment_id))
        .maybeSingle();
      trackingNumber = shipment?.tracking_number ?? null;
    }

    const messageParts = [
      "Thank you for choosing Nabus Motors and Trading.",
      `Your quote reference is ${savedReference}. Save this reference to track your request.`,
      "Our freight team will contact you within 1–2 business days.",
    ];

    if (accountCreated) {
      messageParts.push(
        "Your account is ready — sign in to track everything in your dashboard."
      );
    }

    if (trackingNumber) {
      messageParts.push(`Tracking number: ${trackingNumber}.`);
    }

    return jsonOk(messageParts.join(" "), {
      referenceCode: savedReference,
      trackingNumber,
      accountCreated,
      userId,
      registrationId,
    });
  } catch {
    return jsonError("Invalid request.", 400);
  }
}
