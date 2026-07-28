import "server-only";
import { ROLE_LABELS, type PlatformRole } from "@/lib/platform/permissions";
import { getPublicSiteUrl } from "@/lib/site-url";
import { getWhatsAppConfig } from "@/lib/notifications/whatsapp-config";
import { sendWhatsApp } from "@/lib/notifications/whatsapp-send";
import { sendArkeselSms } from "@/lib/notifications/arkesel";
import {
  getArkeselConfig,
  shouldPreferArkeselSms,
} from "@/lib/notifications/arkesel-config";
import {
  buildMetaTemplatePayload,
  type MetaTemplateKind,
} from "@/lib/notifications/whatsapp-meta-templates";

function roleLabel(role: string): string {
  return ROLE_LABELS[role as PlatformRole] ?? role;
}

export type TeamNotifyChannel = "sms" | "whatsapp" | "none";

export type TeamNotifyStatus =
  | "sent"
  | "skipped_no_phone"
  | "skipped_not_configured"
  | "failed";

export type TeamNotifyResult = {
  channel: TeamNotifyChannel;
  status: TeamNotifyStatus;
  detail?: string;
};

function fireAndForget(task: () => Promise<unknown>): void {
  void task().catch((error) => {
    console.warn(
      "[platform-team-whatsapp] non-blocking failure:",
      error instanceof Error ? error.message : error
    );
  });
}

async function sendTeamSms(phone: string, bodyText: string): Promise<TeamNotifyResult> {
  const arkesel = await getArkeselConfig();
  if (!arkesel.smsReady) {
    return {
      channel: "none",
      status: "skipped_not_configured",
      detail: "Arkesel SMS not configured",
    };
  }
  const sms = await sendArkeselSms(phone, bodyText, arkesel);
  if (!sms.sent) {
    console.warn("[platform-team-whatsapp] Arkesel SMS failed (non-blocking):", sms.reason);
    return {
      channel: "sms",
      status: "failed",
      detail: sms.reason ?? "SMS send failed",
    };
  }
  return { channel: "sms", status: "sent", detail: sms.messageId };
}

async function sendTeamWhatsApp(params: {
  phone: string | null | undefined;
  kind: MetaTemplateKind;
  bodyText: string;
  bodyParameters: string[];
  buttonUrlParameter?: string;
  template: string;
  sourceId?: string;
  idempotencyKey?: string;
}): Promise<TeamNotifyResult> {
  const phone = params.phone?.trim();
  if (!phone) {
    return {
      channel: "none",
      status: "skipped_no_phone",
      detail: "No phone number on file",
    };
  }

  // Prefer Arkesel SMS when configured as primary (or WhatsApp unavailable).
  if (await shouldPreferArkeselSms()) {
    return sendTeamSms(phone, params.bodyText);
  }

  const config = await getWhatsAppConfig();
  if (!config.enabled || !config.teamWhatsAppEnabled) {
    // WhatsApp dormant / disabled — still try SMS if Arkesel is ready.
    return sendTeamSms(phone, params.bodyText);
  }

  const metaTemplate =
    config.provider === "meta"
      ? buildMetaTemplatePayload({
          kind: params.kind,
          settings: config.settings,
          bodyParameters: params.bodyParameters,
          buttonUrlParameter: params.buttonUrlParameter,
        })
      : undefined;

  const wa = await sendWhatsApp(phone, params.bodyText, {
    template: params.template,
    sourceTable: "platform_users",
    sourceId: params.sourceId,
    idempotencyKey: params.idempotencyKey,
    metaTemplate,
    preferMetaTemplate: Boolean(metaTemplate),
  });

  if (wa.sent) {
    return { channel: "whatsapp", status: "sent" };
  }

  const smsFallback = await sendTeamSms(phone, params.bodyText);
  if (smsFallback.status === "sent") return smsFallback;

  return {
    channel: "whatsapp",
    status: "failed",
    detail: wa.reason ?? smsFallback.detail ?? "Notification failed",
  };
}

/** Invite created or resent — never includes secrets. */
export async function notifyTeamInviteWhatsApp(params: {
  phone?: string | null;
  name: string;
  role: string;
  inviteUrl: string;
  userId?: string;
  resent?: boolean;
}): Promise<TeamNotifyResult> {
  const role = roleLabel(params.role);
  const text = `True Goshen: Hi ${params.name}, you're invited as ${role}. Accept here: ${params.inviteUrl}`;
  try {
    return await sendTeamWhatsApp({
      phone: params.phone,
      kind: "team_invite",
      bodyText: text,
      bodyParameters: [params.name, role, params.inviteUrl],
      buttonUrlParameter: params.inviteUrl,
      template: "team_invite",
      sourceId: params.userId,
      idempotencyKey: params.userId
        ? `team_invite:${params.userId}:${params.resent ? "resend" : "create"}:${params.inviteUrl.slice(-12)}`
        : undefined,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invite notify failed";
    console.warn("[platform-team-whatsapp] invite notify failed:", detail);
    return { channel: "none", status: "failed", detail };
  }
}

/** Role changed by admin. */
export async function notifyTeamRoleChangedWhatsApp(params: {
  phone?: string | null;
  name: string;
  role: string;
  userId?: string;
}): Promise<TeamNotifyResult> {
  const role = roleLabel(params.role);
  const text = `True Goshen: Hi ${params.name}, your platform role is now ${role}.`;
  try {
    return await sendTeamWhatsApp({
      phone: params.phone,
      kind: "team_role_changed",
      bodyText: text,
      bodyParameters: [params.name, role],
      template: "team_role_changed",
      sourceId: params.userId,
      idempotencyKey: params.userId
        ? `team_role:${params.userId}:${params.role}`
        : undefined,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Role notify failed";
    console.warn("[platform-team-whatsapp] role notify failed:", detail);
    return { channel: "none", status: "failed", detail };
  }
}

/** Password set by admin — never includes the password. */
export async function notifyTeamPasswordSetWhatsApp(params: {
  phone?: string | null;
  name: string;
  userId?: string;
}): Promise<TeamNotifyResult> {
  const loginUrl = `${getPublicSiteUrl()}/platform/login`;
  const text = `True Goshen: Hi ${params.name}, your admin password was set. Sign in at ${loginUrl}. If this wasn't you, contact the owner.`;
  try {
    return await sendTeamWhatsApp({
      phone: params.phone,
      kind: "team_password_set",
      bodyText: text,
      bodyParameters: [params.name, loginUrl],
      buttonUrlParameter: loginUrl,
      template: "team_password_set",
      sourceId: params.userId,
      idempotencyKey: params.userId
        ? `team_password_set:${params.userId}:${new Date().toISOString().slice(0, 13)}`
        : undefined,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Password notify failed";
    console.warn("[platform-team-whatsapp] password notify failed:", detail);
    return { channel: "none", status: "failed", detail };
  }
}

/** Welcome after invite accept (fire-and-forget — acceptance flow should not block). */
export function notifyTeamWelcomeWhatsApp(params: {
  phone?: string | null;
  name: string;
  role: string;
  userId?: string;
}): void {
  fireAndForget(async () => {
    const role = roleLabel(params.role);
    const dashboardUrl = `${getPublicSiteUrl()}/platform/dashboard`;
    const text = `True Goshen: Welcome ${params.name}! Your ${role} account is active. Open the dashboard: ${dashboardUrl}`;
    await sendTeamWhatsApp({
      phone: params.phone,
      kind: "team_welcome",
      bodyText: text,
      bodyParameters: [params.name, role, dashboardUrl],
      buttonUrlParameter: dashboardUrl,
      template: "team_welcome",
      sourceId: params.userId,
      idempotencyKey: params.userId ? `team_welcome:${params.userId}` : undefined,
    });
  });
}

export function formatTeamNotifyLabel(result: TeamNotifyResult): string {
  if (result.status === "sent") {
    return result.channel === "sms" ? "SMS sent" : "WhatsApp sent";
  }
  if (result.status === "skipped_no_phone") return "SMS skipped (no phone)";
  if (result.status === "skipped_not_configured") return "SMS not configured";
  return result.detail ? `Notify failed: ${result.detail}` : "Notify failed";
}
