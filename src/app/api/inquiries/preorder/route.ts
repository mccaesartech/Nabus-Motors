import { NextRequest } from "next/server";
import { insertRow, jsonError, jsonOk } from "@/lib/inquiries/server";
import { isValidUuid } from "@/lib/inquiries/uuid";
import { formatVehicleName } from "@/lib/format";
import { formatPlatformPrice } from "@/lib/currency";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { resolvePreorderAccount, linkCustomerPreordersByEmail, waitForCustomerProfile } from "@/lib/customer/preorder-account";
import { createServerSupabase } from "@/lib/supabase/server";
import { downPaymentUsd } from "@/lib/vehicles/availability";
import { notDeletedFilter } from "@/lib/platform/trash-types";
import {
  notifyCustomer,
  resolveWhatsAppPreferred,
} from "@/lib/notifications/customer-notify";
import {
  formatPublicCustomerNotificationFeedback,
  type CustomerNotificationPayload,
} from "@/lib/notifications/notification-status";
import { generateCustomerPasswordResetLink } from "@/lib/customer/password-reset";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  notifyVehicleSaleToLeadsTeam,
  preorderLeadsLink,
} from "@/lib/platform/vehicle-sale-notifications";
import { recordVehicleInterest } from "@/lib/vehicle-interest/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      phone,
      message,
      password,
      vehicleId,
      vehiclePriceUsd,
      vehicleSlug,
      vehicleTitle,
      acknowledgeDownPayment,
      shippingHandling,
      shippingTermsAccepted,
      whatsappOptIn,
    } = body;

    const trimmedEmail = String(email).trim();
    const trimmedName = String(name).trim();
    const trimmedPhone = String(phone ?? "").trim();

    if (!trimmedName || !trimmedEmail) {
      return jsonError("Name and email are required.", 400);
    }

    if (!acknowledgeDownPayment) {
      return jsonError("Please acknowledge the 25% down payment requirement.", 400);
    }

    const validShipping = new Set(["customer_arranged", "true_goshen", "consultation"]);
    const shipping = shippingHandling ? String(shippingHandling) : "";
    if (!validShipping.has(shipping)) {
      return jsonError("Please select who will handle shipping and clearing.", 400);
    }
    if (!shippingTermsAccepted) {
      return jsonError("Please accept the shipping and clearing terms.", 400);
    }

    let slug: string | null = vehicleSlug ? String(vehicleSlug).trim() : null;
    let title: string | null = vehicleTitle ? String(vehicleTitle).trim() : null;
    let priceUsd = Number(vehiclePriceUsd) || 0;
    let resolvedVehicleId: string | null = isValidUuid(vehicleId) ? vehicleId : null;

    const supabase = createServerSupabase();
    if (supabase) {
      const vehicleSelect =
        "id, slug, year, make, model, trim, price" as const;

      if (resolvedVehicleId) {
        const { data: vehicle } = await notDeletedFilter(
          supabase
            .from("vehicles")
            .select(vehicleSelect)
            .eq("id", resolvedVehicleId)
        ).maybeSingle();

        if (vehicle) {
          slug = vehicle.slug;
          title = formatVehicleName(vehicle);
          priceUsd = vehicle.price ?? priceUsd;
        } else {
          resolvedVehicleId = null;
        }
      }

      if (!resolvedVehicleId && slug) {
        const { data: vehicle } = await notDeletedFilter(
          supabase
            .from("vehicles")
            .select(vehicleSelect)
            .eq("slug", slug)
        ).maybeSingle();

        if (vehicle) {
          resolvedVehicleId = vehicle.id;
          slug = vehicle.slug;
          title = formatVehicleName(vehicle);
          priceUsd = vehicle.price ?? priceUsd;
        }
      }
    }

    const downPayment = downPaymentUsd(priceUsd);

    const authUser = await getCustomerFromAuthHeader(req.headers.get("authorization"));
    const account = await resolvePreorderAccount({
      authUser,
      email: trimmedEmail,
      name: trimmedName,
      phone,
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
        console.warn(
          "[preorder] profile missing before insert; identifiers omitted and inquiry saved without user link"
        );
        linkedUserId = null;
      }
    }

    const whatsappOptInExplicit =
      whatsappOptIn === true ? true : whatsappOptIn === false ? false : undefined;

    let effectivePhone = trimmedPhone;
    if (linkedUserId) {
      const admin = createAdminSupabase();
      if (admin && !effectivePhone) {
        const { data: profile } = await admin
          .from("profiles")
          .select("phone, whatsapp_opt_in")
          .eq("id", linkedUserId)
          .maybeSingle();
        if (profile?.phone?.trim()) {
          effectivePhone = profile.phone.trim();
        }
      }
    }

    const whatsappPreferred = resolveWhatsAppPreferred(
      effectivePhone || null,
      whatsappOptInExplicit
    );

    const result = await insertRow("preorder_inquiries", {
      vehicle_id: resolvedVehicleId,
      vehicle_slug: slug,
      vehicle_title: title,
      vehicle_price_usd: priceUsd || null,
      user_id: linkedUserId,
      customer_registration_id: registrationId,
      name: trimmedName,
      email: trimmedEmail,
      phone: effectivePhone || null,
      whatsapp_opt_in: whatsappPreferred,
      message: message ?? null,
      down_payment_usd: downPayment,
      payment_status: "pending",
      status: "new",
      source: "website",
      shipping_handling: shipping,
      shipping_terms_accepted: true,
      shipping_terms_accepted_at: new Date().toISOString(),
    });

    if (!result.ok) {
      console.error("[preorder] insert failed:", {
        error: result.error,
        hasVehicle: Boolean(resolvedVehicleId),
        hasUserLink: Boolean(linkedUserId),
        hasRegistrationId: Boolean(registrationId),
      });
      return jsonError("Could not save pre-order inquiry. Try WhatsApp or call us.");
    }

    if (userId) {
      await linkCustomerPreordersByEmail(userId, trimmedEmail, registrationId);
    }

    const inserted = result.data;
    const vehicleLabel = title ?? "this vehicle";
    const accountCreated = Boolean(userId && !authUser);
    const inquiryId = inserted?.id ? String(inserted.id) : undefined;

    const adminSupabase = createAdminSupabase();
    if (inquiryId && adminSupabase) {
      await notifyVehicleSaleToLeadsTeam(adminSupabase, {
        kind: "pre_order",
        customerName: trimmedName,
        customerEmail: trimmedEmail,
        customerPhone: effectivePhone || null,
        vehicleTitles: [vehicleLabel],
        referenceId: inquiryId,
        sourceTable: "preorder_inquiries",
        link: preorderLeadsLink(inquiryId),
        totalUsd: priceUsd || null,
        registrationId,
      });

      if (resolvedVehicleId) {
        await recordVehicleInterest(adminSupabase, {
          vehicleId: resolvedVehicleId,
          activityType: "preorder_inquiry",
          userId: linkedUserId,
          email: trimmedEmail,
          phone: effectivePhone || null,
        });
      }
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
        phone: effectivePhone || null,
        whatsappPreferred,
        customerName: trimmedName,
        template: "preorder_submitted",
        data: {
          vehicleTitle: vehicleLabel,
          registrationId: registrationId ?? undefined,
          passwordResetUrl,
        },
        sourceTable: "preorder_inquiries",
        sourceId: inserted?.id ? String(inserted.id) : undefined,
      });
    } catch (notifyError) {
      console.error("[preorder] notifyCustomer failed:", notifyError);
    }

    const downPaymentLabel = formatPlatformPrice(downPayment);

    const successMessage = registrationId
      ? `Pre-order submitted for ${vehicleLabel}. 25% down payment: ${downPaymentLabel}. Track it in your account (${registrationId}).`
      : `Pre-order submitted for ${vehicleLabel}. 25% down payment: ${downPaymentLabel}. Our team will contact you shortly.`;

    const notificationFeedback = formatPublicCustomerNotificationFeedback(notificationResult);
    const fullMessage = notificationFeedback.message
      ? `${successMessage} ${notificationFeedback.message}`
      : successMessage;

    return jsonOk(fullMessage, {
      registrationId,
      inquiryId,
      bookAppointment: true,
      vehicle: {
        id: resolvedVehicleId,
        name: vehicleLabel,
      },
      notification: notificationResult,
      notificationMessage: notificationFeedback.message || undefined,
      notificationVariant: notificationFeedback.variant,
    });
  } catch {
    return jsonError("Invalid request.", 400);
  }
}
