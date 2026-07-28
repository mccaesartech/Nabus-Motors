import { EMAIL_TEMPLATE_LABELS } from "@/lib/platform/emails";
import { maskPhoneForDisplay } from "@/lib/notifications/notification-status";
import { platformPath } from "@/lib/platform/paths";
import type { AdminNotification } from "@/lib/platform/types";

export type NotificationSeverity = "urgent" | "warning" | "info";

export type NotificationDisplay = {
  title: string;
  message: string;
  severity: NotificationSeverity;
  severityLabel: string;
  link: string | null;
  linkLabel: string;
  setupLink?: { href: string; label: string };
  pendingMessage?: string;
  technicalDetail?: string;
};

export const NOTIFICATION_EVENT_LABELS: Record<string, string> = {
  ...EMAIL_TEMPLATE_LABELS,
  staff_message: "Staff message to customer",
  order_submitted: "Order submitted",
  preorder_status_update: "Pre-order update",
  vehicle_available_locally: "Vehicle available locally",
  account_deletion_scheduled: "Account deletion scheduled",
  account_deletion_cancelled: "Account deletion cancelled",
  account_deletion_completed: "Account deletion completed",
};

type DeliveryLogRow = {
  id: string;
  template: string;
  channel: string;
  status: string;
  recipient: string;
  detail: string | null;
  created_at: string;
  source_table: string | null;
  source_id: string | null;
};

type ParsedDeliveryDetail = {
  reason?: string;
  waMeUrl?: string;
  waMeText?: string;
  raw?: string;
};

export function humanizeEventType(eventType: string): string {
  if (NOTIFICATION_EVENT_LABELS[eventType]) {
    return NOTIFICATION_EVENT_LABELS[eventType];
  }
  return eventType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function decodeWaMeText(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const text = parsed.searchParams.get("text");
    if (!text) return undefined;
    return decodeURIComponent(text.replace(/\+/g, " "));
  } catch {
    return undefined;
  }
}

export function parseDeliveryDetail(detail: string | null | undefined): ParsedDeliveryDetail {
  if (!detail?.trim()) return {};

  const trimmed = detail.trim();
  try {
    const parsed = JSON.parse(trimmed) as ParsedDeliveryDetail;
    if (parsed && typeof parsed === "object") {
      if (parsed.waMeUrl && !parsed.waMeText) {
        parsed.waMeText = decodeWaMeText(parsed.waMeUrl);
      }
      return parsed;
    }
  } catch {
    // Legacy plain-text detail
  }

  const parts = trimmed.split(" | ").map((part) => part.trim()).filter(Boolean);
  let waMeUrl: string | undefined;
  const reasonParts: string[] = [];

  for (const part of parts) {
    if (/^https?:\/\/wa\.me\//i.test(part)) {
      waMeUrl = part;
    } else {
      reasonParts.push(part);
    }
  }

  if (!waMeUrl && /^https?:\/\/wa\.me\//i.test(trimmed)) {
    waMeUrl = trimmed;
  }

  return {
    reason: reasonParts.join(" | ") || (waMeUrl ? undefined : trimmed),
    waMeUrl,
    waMeText: waMeUrl ? decodeWaMeText(waMeUrl) : undefined,
    raw: trimmed,
  };
}

function channelLabel(channel: string): string {
  switch (channel.toLowerCase()) {
    case "whatsapp":
      return "WhatsApp";
    case "email":
      return "Email";
    case "sms":
      return "SMS";
    default:
      return channel.charAt(0).toUpperCase() + channel.slice(1);
  }
}

function isWhatsAppSetupIssue(reason?: string): boolean {
  if (!reason) return false;
  const lower = reason.toLowerCase();
  return (
    lower.includes("not configured") ||
    lower.includes("twilio_") ||
    lower.includes("whatsapp_") ||
    lower.includes("env var") ||
    lower.includes("platform -> settings") ||
    lower.includes("platform → settings")
  );
}

export function resolveNotificationSourceLink(
  sourceTable: string | null | undefined,
  sourceId: string | null | undefined
): { link: string | null; label: string } {
  if (!sourceTable || !sourceId) {
    return { link: null, label: "View details" };
  }

  switch (sourceTable) {
    case "profiles":
      return { link: platformPath(`customers/${sourceId}`), label: "View customer" };
    case "preorder_inquiries":
      return { link: platformPath(`leads/preorder/${sourceId}`), label: "View pre-order" };
    case "freight_quote_requests":
      return {
        link: `${platformPath("freight/quotes")}?id=${encodeURIComponent(sourceId)}`,
        label: "View freight quote",
      };
    case "parts_orders":
      return { link: platformPath(`leads/order/${sourceId}`), label: "View order" };
    case "vehicles":
      return {
        link: platformPath(`inventory/${sourceId}/edit`),
        label: "Edit vehicle / set fulfillment",
      };
    case "checkout_appointments":
    case "appointments":
      return { link: platformPath("appointments"), label: "View appointment" };
    case "freight_shipments":
      return { link: platformPath("freight/tracking"), label: "View shipment" };
    case "vehicle_inquiries":
      return { link: `${platformPath("leads")}?tab=vehicle`, label: "View inquiry" };
    case "contact_inquiries":
      return { link: `${platformPath("leads")}?tab=contact`, label: "View message" };
    case "customer_conversations":
      return {
        link: `${platformPath("messages")}?conversation=${encodeURIComponent(sourceId)}`,
        label: "View conversation",
      };
    default:
      return { link: platformPath("leads"), label: "View lead" };
  }
}

function buildDeliveryDisplay(input: {
  template: string;
  channel: string;
  status: string;
  recipient: string;
  detail: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
}): NotificationDisplay {
  const eventLabel = humanizeEventType(input.template);
  const channel = channelLabel(input.channel);
  const maskedPhone = maskPhoneForDisplay(input.recipient);
  const parsed = parseDeliveryDetail(input.detail);
  const { link, label } = resolveNotificationSourceLink(input.sourceTable, input.sourceId);
  const isDeferred = input.status === "deferred";
  const isFailed = input.status === "failed" || input.status === "undeliverable";
  const setupIssue = isWhatsAppSetupIssue(parsed.reason);

  let title: string;
  if (input.channel === "whatsapp" && input.status === "undeliverable") {
    title = `WhatsApp undeliverable — ${eventLabel}`;
  } else if (input.channel === "whatsapp" && (isDeferred || isFailed)) {
    title = isDeferred
      ? `WhatsApp not sent automatically — ${eventLabel}`
      : `Could not send WhatsApp — ${eventLabel}`;
  } else if (isFailed) {
    title = `Could not send ${channel} — ${eventLabel}`;
  } else if (isDeferred) {
    title = `${channel} needs manual follow-up — ${eventLabel}`;
  } else {
    title = eventLabel;
  }

  let message: string;
  if (input.channel === "whatsapp" && setupIssue) {
    const phonePart = maskedPhone ? ` to customer (${maskedPhone})` : " to customer";
    message = `Could not send WhatsApp${phonePart}. Set up WhatsApp in Settings → Notifications.`;
  } else if (input.channel === "whatsapp" && isFailed) {
    message = maskedPhone
      ? `WhatsApp could not be delivered to ${maskedPhone}.`
      : "WhatsApp could not be delivered.";
  } else if (input.channel === "whatsapp" && isDeferred) {
    message = maskedPhone
      ? `WhatsApp was not sent automatically to ${maskedPhone}. You can send the message manually.`
      : "WhatsApp was not sent automatically. You can send the message manually.";
  } else if (isFailed) {
    message = `The ${channel.toLowerCase()} notification could not be delivered.`;
  } else {
    message = `The ${channel.toLowerCase()} notification needs your attention.`;
  }

  const display: NotificationDisplay = {
    title,
    message,
    severity: isFailed || isDeferred ? "warning" : "info",
    severityLabel: isFailed || isDeferred ? "Warning" : "Info",
    link,
    linkLabel: label,
  };

  if (input.channel === "whatsapp" && setupIssue) {
    display.setupLink = {
      href: platformPath("settings"),
      label: "Set up WhatsApp in Settings",
    };
  }

  if (parsed.waMeText) {
    display.pendingMessage = parsed.waMeText;
  }

  if (parsed.raw || parsed.reason) {
    display.technicalDetail = parsed.raw ?? parsed.reason;
  }

  return display;
}

function parseLegacyDeliveryTitle(title: string): { status?: string; template?: string } | null {
  const match = title.match(/^Delivery (deferred|failed):\s*(.+)$/i);
  if (!match) return null;
  return { status: match[1].toLowerCase(), template: match[2].trim() };
}

function parseLegacyDeliveryMessage(message: string): {
  channel?: string;
  recipient?: string;
  detail?: string;
} | null {
  const match = message.match(/^(\w+)\s*→\s*([^:]+):\s*(.+)$/);
  if (!match) return null;
  return {
    channel: match[1].trim(),
    recipient: match[2].trim(),
    detail: match[3].trim(),
  };
}

export function formatAdminNotificationForDisplay(
  notification: AdminNotification
): NotificationDisplay {
  const { link: sourceLink, label: sourceLabel } = resolveNotificationSourceLink(
    notification.sourceTable,
    notification.sourceId
  );
  const link = notification.link ?? sourceLink;
  const linkLabel = sourceLabel;

  const isDeliveryType =
    notification.type === "delivery_failed" ||
    notification.type === "delivery_deferred" ||
    notification.type === "delivery_issue";

  const legacyTitle = parseLegacyDeliveryTitle(notification.title);
  const legacyMessage = parseLegacyDeliveryMessage(notification.message);
  const metadata = notification.metadata as Record<string, unknown> | undefined;

  if (isDeliveryType || legacyTitle || legacyMessage) {
    const template =
      (typeof metadata?.template === "string" ? metadata.template : undefined) ??
      legacyTitle?.template ??
      notification.type;
    const channel =
      (typeof metadata?.channel === "string" ? metadata.channel : undefined) ??
      legacyMessage?.channel ??
      "whatsapp";
    const status =
      (typeof metadata?.status === "string" ? metadata.status : undefined) ??
      legacyTitle?.status ??
      (notification.type === "delivery_deferred" ? "deferred" : "failed");
    const recipient =
      (typeof metadata?.recipient === "string" ? metadata.recipient : undefined) ??
      legacyMessage?.recipient ??
      "";
    const detail =
      (typeof metadata?.technicalDetail === "string" ? metadata.technicalDetail : undefined) ??
      legacyMessage?.detail ??
      notification.message;

    return buildDeliveryDisplay({
      template,
      channel,
      status,
      recipient,
      detail,
      sourceTable: notification.sourceTable,
      sourceId: notification.sourceId,
    });
  }

  let title = notification.title;
  if (/^[a-z0-9_]+$/.test(notification.title)) {
    title = humanizeEventType(notification.title);
  }

  let severity: NotificationSeverity = "info";
  if (
    notification.type === "low_stock" ||
    notification.type === "vehicle_pending_approval" ||
    notification.type === "vehicle_stock_action"
  ) {
    severity = "urgent";
  } else if (
    ["preorder", "finance", "freight_quote", "appraisal", "delivery_failed", "delivery_deferred"].includes(
      notification.type
    )
  ) {
    severity = "warning";
  }

  const displayLinkLabel =
    notification.type === "vehicle_stock_action"
      ? "Set Ghana availability, pre-order, or import"
      : notification.type === "low_stock"
        ? "Review low stock & add inventory"
        : linkLabel;

  return {
    title,
    message: notification.message,
    severity,
    severityLabel:
      severity === "urgent" ? "Urgent" : severity === "warning" ? "Warning" : "Info",
    link,
    linkLabel: displayLinkLabel,
  };
}

export function mapNotificationLogToAdminNotification(row: DeliveryLogRow): AdminNotification {
  const display = buildDeliveryDisplay({
    template: row.template,
    channel: row.channel,
    status: row.status,
    recipient: row.recipient,
    detail: row.detail,
    sourceTable: row.source_table,
    sourceId: row.source_id,
  });

  const { link } = resolveNotificationSourceLink(row.source_table, row.source_id);

  return {
    id: `notification-log-${row.id}`,
    type: row.status === "deferred" ? "delivery_deferred" : "delivery_failed",
    title: display.title,
    message: display.message,
    link,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    readAt: null,
    createdAt: row.created_at,
    metadata: {
      channel: row.channel,
      status: row.status,
      template: row.template,
      recipient: row.recipient,
      technicalDetail: display.technicalDetail,
      pendingMessage: display.pendingMessage,
      setupLink: display.setupLink,
      severity: display.severity,
    },
  };
}

export function enhanceAdminNotification(notification: AdminNotification): AdminNotification {
  const display = formatAdminNotificationForDisplay(notification);
  const { link } = resolveNotificationSourceLink(
    notification.sourceTable,
    notification.sourceId
  );

  return {
    ...notification,
    title: display.title,
    message: display.message,
    link: notification.link ?? link,
    metadata: {
      ...(notification.metadata ?? {}),
      pendingMessage: display.pendingMessage,
      setupLink: display.setupLink,
      technicalDetail: display.technicalDetail,
      severity: display.severity,
      severityLabel: display.severityLabel,
      linkLabel: display.linkLabel,
    },
  };
}
