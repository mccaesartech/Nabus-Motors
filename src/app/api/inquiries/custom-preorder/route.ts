import { NextRequest } from "next/server";
import { insertRow, jsonError, jsonOk } from "@/lib/inquiries/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import {
  linkCustomerPreordersByEmail,
  resolvePreorderAccount,
  waitForCustomerProfile,
} from "@/lib/customer/preorder-account";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  notifyCustomer,
  resolveWhatsAppPreferred,
} from "@/lib/notifications/customer-notify";
import {
  formatPublicCustomerNotificationFeedback,
  type CustomerNotificationPayload,
} from "@/lib/notifications/notification-status";
import { generateCustomerPasswordResetLink } from "@/lib/customer/password-reset";
import {
  notifyVehicleSaleToLeadsTeam,
  preorderLeadsLink,
} from "@/lib/platform/vehicle-sale-notifications";
import { notifyCustomerCustomRequestSubmitted } from "@/lib/customer/notifications-server";
import { generateCustomRequestReferenceCode } from "@/lib/platform/custom-request-reference";
import {
  buildCustomVehicleTitle,
  type CustomRequestSpecs,
} from "@/lib/platform/custom-request";

async function allocateReferenceCode(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateCustomRequestReferenceCode();
    const { data } = await admin
      .from("preorder_inquiries")
      .select("id")
      .eq("reference_code", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return generateCustomRequestReferenceCode();
}

function parseBudgetGhs(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      phone,
      password,
      whatsappOptIn,
      make,
      model,
      year,
      budgetMin,
      budgetMax,
      bodyType,
      fuelType,
      condition,
      notes,
      preferredTimeline,
    } = body;

    const trimmedName = String(name ?? "").trim();
    const trimmedEmail = String(email ?? "").trim();
    const trimmedPhone = String(phone ?? "").trim();
    const trimmedMake = String(make ?? "").trim();
    const trimmedModel = String(model ?? "").trim();
    const trimmedYear = String(year ?? "").trim();

    if (!trimmedName || !trimmedEmail) {
      return jsonError("Name and email are required.", 400);
    }

    if (!trimmedPhone) {
      return jsonError("Phone number is required so we can follow up.", 400);
    }

    if (!trimmedMake || !trimmedModel) {
      return jsonError("Please enter the make and model you are looking for.", 400);
    }

    const parsedBudgetMin = parseBudgetGhs(budgetMin);
    const parsedBudgetMax = parseBudgetGhs(budgetMax);
    if (
      parsedBudgetMin != null &&
      parsedBudgetMax != null &&
      parsedBudgetMin > parsedBudgetMax
    ) {
      return jsonError("Minimum budget cannot exceed maximum budget.", 400);
    }

    const specs: CustomRequestSpecs = {};
    if (bodyType) specs.body_type = String(bodyType).trim();
    if (fuelType) specs.fuel_type = String(fuelType).trim();
    if (condition) specs.condition = String(condition).trim();
    if (notes) specs.notes = String(notes).trim();
    if (preferredTimeline) specs.preferred_timeline = String(preferredTimeline).trim();

    const vehicleTitle = buildCustomVehicleTitle(trimmedMake, trimmedModel, trimmedYear);

    const authUser = await getCustomerFromAuthHeader(req.headers.get("authorization"));
    const account = await resolvePreorderAccount({
      authUser,
      email: trimmedEmail,
      name: trimmedName,
      phone: trimmedPhone,
      password,
    });

    if (account.error) {
      return jsonError(account.error, 400);
    }

    const userId = account.userId;
    const registrationId = account.registrationId;

    let linkedUserId = userId;
    if (linkedUserId) {
      const profileReady = await waitForCustomerProfile(linkedUserId);
      if (!profileReady) {
        linkedUserId = null;
      }
    }

    const whatsappOptInExplicit =
      whatsappOptIn === true ? true : whatsappOptIn === false ? false : undefined;

    const whatsappPreferred = resolveWhatsAppPreferred(
      trimmedPhone || null,
      whatsappOptInExplicit
    );

    const adminSupabase = createAdminSupabase();
    const referenceCode = adminSupabase
      ? await allocateReferenceCode(adminSupabase)
      : generateCustomRequestReferenceCode();

    const result = await insertRow("preorder_inquiries", {
      is_custom_request: true,
      vehicle_id: null,
      vehicle_slug: null,
      vehicle_title: vehicleTitle,
      vehicle_price_usd: null,
      requested_make: trimmedMake,
      requested_model: trimmedModel,
      requested_year: trimmedYear || null,
      requested_specs: specs,
      budget_min: parsedBudgetMin,
      budget_max: parsedBudgetMax,
      reference_code: referenceCode,
      user_id: linkedUserId,
      customer_registration_id: registrationId,
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      whatsapp_opt_in: whatsappPreferred,
      message: specs.notes ?? null,
      down_payment_usd: 0,
      payment_status: "pending",
      status: "reviewing",
      source: "website",
    });

    if (!result.ok) {
      console.error("[custom-preorder] insert failed:", result.error);
      return jsonError("Could not save your request. Please try again or contact us.");
    }

    if (userId) {
      await linkCustomerPreordersByEmail(userId, trimmedEmail, registrationId);
    } else if (linkedUserId) {
      await linkCustomerPreordersByEmail(linkedUserId, trimmedEmail, registrationId);
    }

    const inserted = result.data;
    const inquiryId = inserted?.id ? String(inserted.id) : undefined;
    const accountCreated = Boolean(userId && !authUser);
    const notifyUserId = linkedUserId ?? userId;

    if (inquiryId && adminSupabase && notifyUserId) {
      await notifyCustomerCustomRequestSubmitted(adminSupabase, {
        userId: notifyUserId,
        requestId: inquiryId,
        referenceCode,
        vehicleTitle,
      });
    }

    if (inquiryId && adminSupabase) {
      await notifyVehicleSaleToLeadsTeam(adminSupabase, {
        kind: "pre_order",
        customerName: trimmedName,
        customerEmail: trimmedEmail,
        customerPhone: trimmedPhone,
        vehicleTitles: [vehicleTitle],
        referenceId: inquiryId,
        sourceTable: "preorder_inquiries",
        link: preorderLeadsLink(inquiryId),
        registrationId: referenceCode,
      });
    }

    let passwordResetUrl: string | undefined;
    if (accountCreated && trimmedEmail) {
      const linkResult = await generateCustomerPasswordResetLink(trimmedEmail);
      if ("resetUrl" in linkResult) {
        passwordResetUrl = linkResult.resetUrl;
      }
    }

    let notificationResult: CustomerNotificationPayload | null = null;
    try {
      notificationResult = await notifyCustomer({
        email: trimmedEmail,
        phone: trimmedPhone,
        whatsappPreferred,
        customerName: trimmedName,
        template: "custom_request_submitted",
        data: {
          vehicleTitle,
          referenceCode,
          registrationId: registrationId ?? undefined,
          passwordResetUrl,
        },
        sourceTable: "preorder_inquiries",
        sourceId: inquiryId,
      });
    } catch (notifyError) {
      console.error("[custom-preorder] notifyCustomer failed:", notifyError);
    }

    const successMessage = `Request submitted! Reference: ${referenceCode}. Our team will review whether we can source ${vehicleTitle} and contact you soon.`;

    const notificationFeedback = formatPublicCustomerNotificationFeedback(notificationResult);
    const fullMessage = notificationFeedback.message
      ? `${successMessage} ${notificationFeedback.message}`
      : successMessage;

    return jsonOk(fullMessage, {
      referenceCode,
      registrationId,
      inquiryId,
      vehicle: { name: vehicleTitle },
      notification: notificationResult,
      notificationMessage: notificationFeedback.message || undefined,
      notificationVariant: notificationFeedback.variant,
    });
  } catch {
    return jsonError("Invalid request.", 400);
  }
}
