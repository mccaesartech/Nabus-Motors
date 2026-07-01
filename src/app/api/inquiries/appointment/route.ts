import { NextRequest } from "next/server";
import { getCustomerFromAuthHeader } from "@/lib/customer/auth";
import { jsonError, jsonOk } from "@/lib/inquiries/server";
import { isValidUuid } from "@/lib/inquiries/uuid";
import {
  notifyCustomer,
  resolveWhatsAppPreferred,
} from "@/lib/notifications/customer-notify";
import {
  formatPublicCustomerNotificationFeedback,
  type CustomerNotificationPayload,
} from "@/lib/notifications/notification-status";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/platform/site-settings";

type AppointmentVehicleInput = {
  id?: string;
  name?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      phone,
      preferredDate,
      preferredTime,
      branch,
      notes,
      vehicleId,
      vehicleIds,
      orderId,
      inquiryId,
      source,
      whatsappOptIn,
    } = body as {
      name?: string;
      email?: string;
      phone?: string;
      preferredDate?: string;
      preferredTime?: string;
      branch?: string;
      notes?: string;
      vehicleId?: string;
      vehicleIds?: AppointmentVehicleInput[];
      orderId?: string;
      inquiryId?: string;
      source?: string;
      whatsappOptIn?: boolean;
    };

    const trimmedName = String(name ?? "").trim();
    const trimmedEmail = String(email ?? "").trim();
    const trimmedPhone = String(phone ?? "").trim();

    if (!trimmedName || !trimmedEmail) {
      return jsonError("Name and email are required.", 400);
    }

    if (!trimmedPhone) {
      return jsonError("Phone number is required to schedule your visit.", 400);
    }

    if (!preferredDate?.trim()) {
      return jsonError("Please choose a preferred date.", 400);
    }

    const appointmentSource =
      source === "checkout" || source === "preorder" ? source : "website";

    const resolvedVehicleIds: string[] = [];
    if (isValidUuid(vehicleId)) resolvedVehicleIds.push(vehicleId);
    for (const entry of Array.isArray(vehicleIds) ? vehicleIds : []) {
      if (entry?.id && isValidUuid(entry.id) && !resolvedVehicleIds.includes(entry.id)) {
        resolvedVehicleIds.push(entry.id);
      }
    }

    const primaryVehicleId = resolvedVehicleIds[0] ?? null;
    const user = await getCustomerFromAuthHeader(req.headers.get("authorization"));
    const supabase = createAdminSupabase() ?? createServerSupabase();

    if (!supabase) {
      return jsonOk("Appointment request received. Our team will contact you shortly.", {
        appointmentId: null,
      });
    }

    const settings = await getSiteSettings();
    const branchList = settings.appointmentBranchList;
    const resolvedBranch =
      branch?.trim() ||
      branchList[0] ||
      settings.address_line1?.trim() ||
      "Accra";

    const row: Record<string, unknown> = {
      user_id: user?.id ?? null,
      vehicle_id: primaryVehicleId,
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      appointment_type: "viewing",
      preferred_date: preferredDate.trim(),
      preferred_time: preferredTime?.trim() || null,
      branch: resolvedBranch,
      notes: notes?.trim() || null,
      status: "pending",
      confirmation_method: "email",
      source: appointmentSource,
      vehicle_ids: resolvedVehicleIds,
    };

    if (isValidUuid(orderId)) row.order_id = orderId;
    if (isValidUuid(inquiryId)) row.inquiry_id = inquiryId;

    let insert = await supabase.from("vehicle_appointments").insert(row).select("id").single();

    if (insert.error && /column|schema cache/i.test(insert.error.message)) {
      const fallback = { ...row };
      delete fallback.order_id;
      delete fallback.inquiry_id;
      delete fallback.source;
      delete fallback.vehicle_ids;
      insert = await supabase.from("vehicle_appointments").insert(fallback).select("id").single();
    }

    if (insert.error || !insert.data) {
      console.error("[appointment] insert failed:", insert.error?.message);
      return jsonError("Could not save your appointment request. Please try again.", 500);
    }

    const whatsappPreferred = resolveWhatsAppPreferred(
      trimmedPhone,
      whatsappOptIn === true ? true : whatsappOptIn === false ? false : undefined
    );

    let notificationResult: CustomerNotificationPayload | null = null;
    try {
      notificationResult = await notifyCustomer({
        email: trimmedEmail,
        phone: trimmedPhone,
        whatsappPreferred,
        customerName: trimmedName,
        template: "appointment_request_received",
        data: {
          appointmentDate: preferredDate.trim(),
          appointmentTime: preferredTime?.trim(),
          branch: resolvedBranch,
        },
        sourceTable: "vehicle_appointments",
        sourceId: String(insert.data.id),
      });
    } catch (notifyError) {
      console.error("[appointment] notifyCustomer failed:", notifyError);
    }

    const notificationFeedback = formatPublicCustomerNotificationFeedback(notificationResult);
    const baseMessage =
      "Appointment request received. Our team will confirm your visit and payment details.";
    const fullMessage = notificationFeedback.message
      ? `${baseMessage} ${notificationFeedback.message}`
      : baseMessage;

    return jsonOk(fullMessage, {
      appointmentId: insert.data.id,
      notificationMessage: notificationFeedback.message || undefined,
      notificationVariant: notificationFeedback.variant,
    });
  } catch {
    return jsonError("Invalid request.", 400);
  }
}
