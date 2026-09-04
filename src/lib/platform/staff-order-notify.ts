import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyAdminOutbound } from "@/lib/notifications/admin-notify";
import { sendCustomerNotificationEmail } from "@/lib/notifications/customer-email";
import { insertWhatsAppNotificationLog } from "@/lib/notifications/whatsapp-log";
import { sendArkeselSms } from "@/lib/notifications/arkesel";
import { getArkeselConfig } from "@/lib/notifications/arkesel-config";
import {
  hasPermission,
  normalizeRole,
  type PlatformPermission,
} from "@/lib/platform/permissions";
import { getSiteSettings } from "@/lib/platform/site-settings-server";
import { getPublicSiteUrl } from "@/lib/site-url";

export const STAFF_ORDER_NOTIFY_TEMPLATE = "staff_new_order";

type InAppRecipient = {
  user_id: string | null;
  is_owner: boolean;
};

export type StaffOrderNotifyInput = {
  /** admin_notifications.type — e.g. preorder, vehicle_order, order, freight_quote */
  notificationType: string;
  title: string;
  message: string;
  link: string;
  sourceTable: string;
  sourceId: string;
  /** Platform permission used to target in-app + direct staff alerts */
  permission: PlatformPermission;
  metadata?: Record<string, unknown>;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  /** When false, skip Resend/SMS outbound (in-app still fires). */
  outboundEnabled?: boolean;
  /** Override operational notification email (freight uses its own setting). */
  outboundEmail?: string | null;
};

type ActiveStaffMember = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
};

function absolutePlatformLink(link: string): string {
  const trimmed = link.trim();
  if (!trimmed) return getPublicSiteUrl();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const path = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  return new URL(path, `${getPublicSiteUrl()}/`).toString();
}

export function staffOrderNotifyIdempotencyKey(
  sourceTable: string,
  sourceId: string
): string {
  return `${STAFF_ORDER_NOTIFY_TEMPLATE}:${sourceTable}:${sourceId}`;
}

/** Returns false when this order was already claimed for staff outbound alerts. */
export async function claimStaffOrderNotification(
  sourceTable: string,
  sourceId: string
): Promise<boolean> {
  const id = await insertWhatsAppNotificationLog({
    sourceTable,
    sourceId,
    template: STAFF_ORDER_NOTIFY_TEMPLATE,
    channel: "system",
    status: "queued",
    recipient: sourceId,
    provider: "throttle",
    idempotencyKey: staffOrderNotifyIdempotencyKey(sourceTable, sourceId),
    detail: { reason: "staff_order_notify_claim" },
  });
  return Boolean(id);
}

async function inAppRecipients(
  supabase: SupabaseClient,
  permission: PlatformPermission
): Promise<InAppRecipient[]> {
  const recipients: InAppRecipient[] = [{ user_id: null, is_owner: true }];

  const { data } = await supabase
    .from("platform_users")
    .select("id, role, status")
    .eq("status", "active");

  for (const user of data ?? []) {
    const role = normalizeRole(user.role);
    if (hasPermission(role, permission)) {
      recipients.push({ user_id: user.id, is_owner: false });
    }
  }

  return recipients;
}

async function activeStaffWithPermission(
  supabase: SupabaseClient,
  permission: PlatformPermission
): Promise<ActiveStaffMember[]> {
  const { data } = await supabase
    .from("platform_users")
    .select("id, name, email, phone, role, status")
    .eq("status", "active");

  const members: ActiveStaffMember[] = [];
  for (const user of data ?? []) {
    const role = normalizeRole(user.role);
    if (!hasPermission(role, permission)) continue;
    const email = user.email?.trim().toLowerCase() || "";
    const phone = user.phone?.trim() || null;
    if (!email && !phone) continue;
    members.push({
      id: user.id,
      name: user.name?.trim() || "Team member",
      email,
      phone,
      role,
    });
  }
  return members;
}

function buildStaffSmsBody(title: string, message: string, link: string): string {
  return `Nabus Motors: ${title}. ${message} Attend now: ${link}`;
}

async function logStaffOutbound(row: {
  sourceTable: string;
  sourceId: string;
  channel: "email" | "sms";
  status: "sent" | "failed" | "skipped";
  recipient: string;
  detail?: string;
  providerMessageId?: string;
}): Promise<void> {
  await insertWhatsAppNotificationLog({
    sourceTable: row.sourceTable,
    sourceId: row.sourceId,
    template: STAFF_ORDER_NOTIFY_TEMPLATE,
    channel: row.channel,
    status: row.status,
    recipient: row.recipient,
    provider: row.channel === "sms" ? "arkesel" : "resend",
    providerMessageId: row.providerMessageId,
    detail: row.detail ? { reason: row.detail } : undefined,
  });
}

async function notifyStaffMemberDirect(params: {
  member: ActiveStaffMember;
  subject: string;
  bodyText: string;
  reviewUrl: string;
  sourceTable: string;
  sourceId: string;
}): Promise<void> {
  const { member, subject, bodyText, reviewUrl, sourceTable, sourceId } = params;

  if (member.email) {
    const result = await sendCustomerNotificationEmail({
      to: member.email,
      subject,
      text: `${bodyText}\n\nReview in platform: ${reviewUrl}`,
    });
    await logStaffOutbound({
      sourceTable,
      sourceId,
      channel: "email",
      status: result.emailSent ? "sent" : "failed",
      recipient: member.email,
      detail: result.emailSent ? undefined : result.emailError,
      providerMessageId: result.resendId,
    });
  }

  if (member.phone) {
    const arkesel = await getArkeselConfig();
    if (!arkesel.smsReady) {
      await logStaffOutbound({
        sourceTable,
        sourceId,
        channel: "sms",
        status: "skipped",
        recipient: member.phone,
        detail: "Arkesel SMS not configured",
      });
      return;
    }

    const sms = await sendArkeselSms(
      member.phone,
      buildStaffSmsBody(subject, bodyText, reviewUrl),
      arkesel
    );
    await logStaffOutbound({
      sourceTable,
      sourceId,
      channel: "sms",
      status: sms.sent ? "sent" : "failed",
      recipient: member.phone,
      detail: sms.sent ? undefined : sms.reason,
      providerMessageId: sms.sent ? sms.messageId : undefined,
    });
  }
}

/**
 * In-app bell for owner + permission holders, plus email/SMS to operational
 * contacts and individual staff with contact info on file. One outbound burst
 * per order (idempotent on source_table + source_id).
 */
export async function notifyStaffNewOrder(
  supabase: SupabaseClient,
  input: StaffOrderNotifyInput
): Promise<void> {
  const reviewUrl = absolutePlatformLink(input.link);
  const metadata = {
    ...input.metadata,
    customer: {
      name: input.customerName,
      email: input.customerEmail,
      phone: input.customerPhone ?? null,
    },
    reference_id: input.sourceId,
  };

  await supabase
    .from("admin_notifications")
    .delete()
    .eq("source_table", input.sourceTable)
    .eq("source_id", input.sourceId);

  const recipients = await inAppRecipients(supabase, input.permission);
  const rows = recipients.map((recipient) => ({
    type: input.notificationType,
    title: input.title,
    message: input.message,
    link: input.link,
    source_table: input.sourceTable,
    source_id: input.sourceId,
    recipient_user_id: recipient.is_owner ? null : recipient.user_id,
    recipient_is_owner: recipient.is_owner,
    metadata,
  }));

  const { error } = await supabase.from("admin_notifications").insert(rows);
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.error("[staff-order-notify] admin notification insert failed:", error.message);
  }

  const outboundEnabled = input.outboundEnabled ?? true;
  if (!outboundEnabled) return;

  const claimed = await claimStaffOrderNotification(input.sourceTable, input.sourceId);
  if (!claimed) return;

  const settings = await getSiteSettings();
  const bodyText = `${input.message}\n\nCustomer: ${input.customerName} · ${input.customerEmail}${
    input.customerPhone?.trim() ? ` · ${input.customerPhone.trim()}` : ""
  }`;

  try {
    const operationalEmail =
      input.outboundEmail?.trim() ||
      settings.notification_email?.trim() ||
      settings.email?.trim() ||
      "";

    if (settings.notifyEmailEnabled && operationalEmail) {
      await notifyAdminOutbound({
        subject: input.title,
        message: `${bodyText}\n\nReview in platform: ${reviewUrl}`,
        settings: {
          ...settings,
          notification_email: operationalEmail,
        },
      });
    }
  } catch (notifyError) {
    console.error("[staff-order-notify] operational outbound failed:", notifyError);
  }

  try {
    const staff = await activeStaffWithPermission(supabase, input.permission);
    await Promise.all(
      staff.map((member) =>
        notifyStaffMemberDirect({
          member,
          subject: input.title,
          bodyText,
          reviewUrl,
          sourceTable: input.sourceTable,
          sourceId: input.sourceId,
        })
      )
    );
  } catch (staffError) {
    console.error("[staff-order-notify] direct staff notify failed:", staffError);
  }
}

/** Fire-and-forget wrapper — never blocks customer order submission. */
export function scheduleStaffNewOrder(
  supabase: SupabaseClient,
  input: StaffOrderNotifyInput
): void {
  void notifyStaffNewOrder(supabase, input).catch((error) => {
    console.warn(
      "[staff-order-notify] non-blocking failure:",
      error instanceof Error ? error.message : error
    );
  });
}
