import "server-only";
import { ROLE_LABELS, type PlatformRole } from "@/lib/platform/permissions";
import { adminLoginPath } from "@/lib/admin/paths";
import { platformDashboardPath } from "@/lib/platform/paths";
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
import { insertWhatsAppNotificationLog } from "@/lib/notifications/whatsapp-log";
import { logAppError } from "@/lib/errors/logger";

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

type TeamSmsContext = {
  template: string;
  sourceId?: string;
};

/**
 * Team SMS is written to notification_log the same way customer sends are, so
 * Platform → Notifications shows whether a role/invite SMS actually left.
 */
async function logTeamSms(
  context: TeamSmsContext,
  row: { status: "sent" | "failed" | "skipped"; recipient: string; detail: string | null; providerMessageId?: string }
): Promise<void> {
  await insertWhatsAppNotificationLog({
    sourceTable: "platform_users",
    sourceId: context.sourceId,
    template: context.template,
    channel: "sms",
    status: row.status,
    recipient: row.recipient,
    provider: "arkesel",
    providerMessageId: row.providerMessageId,
    ...(row.detail ? { detail: { reason: row.detail, provider: "arkesel" } } : {}),
  });
}

async function sendTeamSms(
  phone: string,
  bodyText: string,
  context: TeamSmsContext
): Promise<TeamNotifyResult> {
  const arkesel = await getArkeselConfig();
  if (!arkesel.smsReady) {
    const detail =
      "Arkesel SMS not configured — set ARKESEL_API_KEY and ARKESEL_SENDER_ID in Vercel, or in Platform → Settings → SMS (Arkesel).";
    await logTeamSms(context, { status: "skipped", recipient: phone, detail });
    return {
      channel: "none",
      status: "skipped_not_configured",
      detail: "Arkesel SMS not configured",
    };
  }

  const sms = await sendArkeselSms(phone, bodyText, arkesel);
  if (!sms.sent) {
    const detail = sms.reason ?? "SMS send failed";
    console.warn("[platform-team-whatsapp] Arkesel SMS failed (non-blocking):", detail);
    logAppError({
      error: new Error(detail),
      module: "notifications.platform_team.sms",
      userMessage: "The SMS could not be sent.",
      kind: "external_service",
      status: 502,
      context: {
        provider: "arkesel",
        template: context.template,
        sourceId: context.sourceId ?? null,
        providerMessage: detail,
      },
    });
    await logTeamSms(context, {
      status: "failed",
      recipient: phone,
      detail,
    });
    return {
      channel: "sms",
      status: "failed",
      detail,
    };
  }

  const messageId = sms.messageId;
  await logTeamSms(context, {
    status: "sent",
    recipient: phone,
    detail: messageId
      ? `Arkesel accepted; messageId=${messageId}`
      : "Arkesel accepted (no message id)",
    providerMessageId: messageId,
  });
  return { channel: "sms", status: "sent", detail: messageId };
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

  const smsContext: TeamSmsContext = {
    template: params.template,
    sourceId: params.sourceId,
  };

  // Prefer Arkesel SMS when configured as primary (or WhatsApp unavailable).
  if (await shouldPreferArkeselSms()) {
    return sendTeamSms(phone, params.bodyText, smsContext);
  }

  const config = await getWhatsAppConfig();
  if (!config.enabled || !config.teamWhatsAppEnabled) {
    // WhatsApp dormant / disabled — still try SMS if Arkesel is ready.
    return sendTeamSms(phone, params.bodyText, smsContext);
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

  const smsFallback = await sendTeamSms(phone, params.bodyText, smsContext);
  if (smsFallback.status === "sent") return smsFallback;

  return {
    channel: "whatsapp",
    status: "failed",
    detail: wa.reason ?? smsFallback.detail ?? "Notification failed",
  };
}

/** Invite SMS/WhatsApp body — invite link only (no password). */
export function buildTeamInviteMessage(params: {
  name: string;
  role: string;
  inviteUrl: string;
}): string {
  const role = roleLabel(params.role);
  return `True Goshen: Hi ${params.name}, you're invited as ${role}. Accept here: ${params.inviteUrl}`;
}

export type TeamPasswordLinkKind = "invite" | "login";

function resolvePasswordLinkKind(
  actionUrl: string,
  linkKind?: TeamPasswordLinkKind
): TeamPasswordLinkKind {
  if (linkKind) return linkKind;
  return /\/invite\//i.test(actionUrl) ? "invite" : "login";
}

/**
 * Password-set SMS/WhatsApp body.
 * When `temporaryPassword` is provided it is included and clearly labeled.
 * Callers must pass plaintext only at send time — never from DB.
 * Prefer an invite acceptance URL when a token exists; otherwise staff login.
 * Never call Staff/Manager an "admin account".
 */
export function buildTeamPasswordSetMessage(params: {
  name: string;
  role?: string;
  /** Invite acceptance URL or staff login URL. */
  loginUrl: string;
  temporaryPassword?: string;
  linkKind?: TeamPasswordLinkKind;
}): string {
  // Do not trim — must match the exact string that was hashed for login.
  const temporaryPassword = params.temporaryPassword;
  const kind = resolvePasswordLinkKind(params.loginUrl, params.linkKind);
  const label = params.role ? roleLabel(params.role) : "platform";
  if (temporaryPassword) {
    if (kind === "invite") {
      return `True Goshen: Hi ${params.name}, your ${label} account is ready. Temporary password: ${temporaryPassword}. Accept invite: ${params.loginUrl}`;
    }
    return `True Goshen: Hi ${params.name}, your ${label} password was updated. Temporary password: ${temporaryPassword}. Sign in at ${params.loginUrl}. Change it after signing in.`;
  }
  if (kind === "invite") {
    return `True Goshen: Hi ${params.name}, your ${label} password was set. Accept invite: ${params.loginUrl}. If this wasn't you, contact the owner.`;
  }
  return `True Goshen: Hi ${params.name}, your ${label} password was set. Sign in at ${params.loginUrl}. If this wasn't you, contact the owner.`;
}

/** Staff login URL used when the account is already active (no pending invite). */
export function buildPlatformAdminLoginUrl(siteUrl = getPublicSiteUrl()): string {
  const path = adminLoginPath();
  return new URL(path.startsWith("/") ? path.slice(1) : path, `${siteUrl}/`).toString();
}

/** Invite created or resent — link only unless a temporary password is supplied. */
export async function notifyTeamInviteWhatsApp(params: {
  phone?: string | null;
  name: string;
  role: string;
  inviteUrl: string;
  userId?: string;
  resent?: boolean;
}): Promise<TeamNotifyResult> {
  const role = roleLabel(params.role);
  const text = buildTeamInviteMessage(params);
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

/**
 * Password set by admin. When `temporaryPassword` is passed (create/set flows),
 * it is included in the SMS body. Never log or persist that plaintext.
 * Pass `actionUrl` as the invite acceptance link whenever a token exists.
 */
export async function notifyTeamPasswordSetWhatsApp(params: {
  phone?: string | null;
  name: string;
  role?: string;
  userId?: string;
  temporaryPassword?: string;
  /** Invite URL (preferred) or staff login URL. Defaults to staff login. */
  actionUrl?: string;
  linkKind?: TeamPasswordLinkKind;
}): Promise<TeamNotifyResult> {
  const loginUrl = params.actionUrl?.trim() || buildPlatformAdminLoginUrl();
  const text = buildTeamPasswordSetMessage({
    name: params.name,
    role: params.role,
    loginUrl,
    temporaryPassword: params.temporaryPassword,
    linkKind: params.linkKind,
  });
  try {
    return await sendTeamWhatsApp({
      phone: params.phone,
      kind: "team_password_set",
      bodyText: text,
      // Meta template params stay non-secret; SMS/bodyText carries the temp password.
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
    const dashboardUrl = `${getPublicSiteUrl()}${platformDashboardPath()}`;
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

/** SMS body after a successful self-service platform password change. */
export function buildTeamPasswordChangedMessage(params: {
  name: string;
  when: string;
  ip?: string | null;
  securityUrl: string;
}): string {
  const ipPart = params.ip?.trim()
    ? ` Approximate IP: ${params.ip.trim()}.`
    : "";
  return `True Goshen: Hi ${params.name}, your platform password was changed at ${params.when}.${ipPart} If this wasn't you, secure your account: ${params.securityUrl}`;
}

/** SMS body for self-serve platform password reset (link only — never a password). */
export function buildTeamPasswordResetMessage(params: {
  name: string;
  resetUrl: string;
  expiryLabel?: string;
}): string {
  const expiry = params.expiryLabel?.trim() || "1 hour";
  return `True Goshen: Hi ${params.name}, reset your platform password here: ${params.resetUrl} (expires in ${expiry}). If you didn't request this, ignore this message.`;
}

/**
 * Self-serve forgot-password SMS. Never includes a temporary password —
 * only the one-time reset URL.
 */
export async function notifyTeamPasswordReset(params: {
  phone?: string | null;
  name: string;
  resetUrl: string;
  expiryLabel?: string;
  userId?: string;
}): Promise<TeamNotifyResult> {
  const phone = params.phone?.trim();
  if (!phone) {
    return {
      channel: "none",
      status: "skipped_no_phone",
      detail: "No phone number on file",
    };
  }

  const text = buildTeamPasswordResetMessage(params);
  try {
    return await sendTeamSms(phone, text, {
      template: "platform_password_reset",
      sourceId: params.userId,
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Password-reset SMS failed";
    console.warn("[platform-team-whatsapp] password-reset notify failed:", detail);
    return { channel: "none", status: "failed", detail };
  }
}

/**
 * Self-service password-changed alert (email companion is separate).
 * SMS via Arkesel when phone is on file — never includes the new password.
 */
export async function notifyTeamPasswordChanged(params: {
  phone?: string | null;
  name: string;
  when: string;
  ip?: string | null;
  securityUrl: string;
  userId?: string;
}): Promise<TeamNotifyResult> {
  const phone = params.phone?.trim();
  if (!phone) {
    return {
      channel: "none",
      status: "skipped_no_phone",
      detail: "No phone number on file",
    };
  }

  const text = buildTeamPasswordChangedMessage(params);
  try {
    return await sendTeamSms(phone, text, {
      template: "platform_password_changed",
      sourceId: params.userId,
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Password-changed SMS failed";
    console.warn("[platform-team-whatsapp] password-changed notify failed:", detail);
    return { channel: "none", status: "failed", detail };
  }
}

/** SMS body for successful platform sign-in (no Meta template — Arkesel path). */
export function buildTeamLoginAlertMessage(params: {
  name: string;
  role: string;
  when: string;
  ip?: string | null;
  securityUrl: string;
}): string {
  const role = roleLabel(params.role);
  const ipPart = params.ip?.trim()
    ? ` Approximate IP: ${params.ip.trim()}.`
    : "";
  return `True Goshen: Hi ${params.name}, you signed in to your ${role} account at ${params.when}.${ipPart} If this wasn't you, change your password: ${params.securityUrl}`;
}

/** SMS body for failed platform sign-in (no Meta template — Arkesel path). */
export function buildTeamFailedLoginAlertMessage(params: {
  name: string;
  role: string;
  when: string;
  ip?: string | null;
  device?: string | null;
  securityUrl: string;
}): string {
  const role = roleLabel(params.role);
  const ipPart = params.ip?.trim()
    ? ` Approximate IP: ${params.ip.trim()}.`
    : "";
  const devicePart = params.device?.trim() ? ` Device: ${params.device.trim()}.` : "";
  return `True Goshen: Hi ${params.name}, someone failed to sign in to your ${role} account at ${params.when}.${devicePart}${ipPart} If this wasn't you, change your password: ${params.securityUrl}`;
}

export async function notifyTeamFailedLoginAlert(params: {
  phone?: string | null;
  name: string;
  role: string;
  when: string;
  ip?: string | null;
  device?: string | null;
  securityUrl: string;
  userId?: string;
}): Promise<TeamNotifyResult> {
  const phone = params.phone?.trim();
  if (!phone) {
    return {
      channel: "none",
      status: "skipped_no_phone",
      detail: "No phone number on file",
    };
  }

  const text = buildTeamFailedLoginAlertMessage(params);
  try {
    return await sendTeamSms(phone, text, {
      template: "platform_login_failed",
      sourceId: params.userId,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Failed login alert SMS failed";
    console.warn("[platform-team-whatsapp] failed login alert failed:", detail);
    return { channel: "none", status: "failed", detail };
  }
}

/**
 * Login security alert via SMS (Arkesel). Skips Meta WhatsApp templates —
 * there is no approved team_login template, and SMS is the reliable staff channel.
 */
export async function notifyTeamLoginAlert(params: {
  phone?: string | null;
  name: string;
  role: string;
  when: string;
  ip?: string | null;
  securityUrl: string;
  userId?: string;
}): Promise<TeamNotifyResult> {
  const phone = params.phone?.trim();
  if (!phone) {
    return {
      channel: "none",
      status: "skipped_no_phone",
      detail: "No phone number on file",
    };
  }

  const text = buildTeamLoginAlertMessage(params);
  try {
    return await sendTeamSms(phone, text, {
      template: "platform_login",
      sourceId: params.userId,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Login alert SMS failed";
    console.warn("[platform-team-whatsapp] login alert failed:", detail);
    return { channel: "none", status: "failed", detail };
  }
}

/**
 * Owner-facing labels stay short. Technical reasons live in `detail` (tooltip /
 * Platform → Notifications), not in the badge or toast text.
 */
export function formatTeamNotifyLabel(result: TeamNotifyResult): string {
  if (result.status === "sent") {
    // Gateway accept / queue only — not handset delivery (no DLR in this path).
    return result.channel === "sms" ? "SMS submitted" : "WhatsApp sent";
  }
  if (result.status === "skipped_no_phone") return "SMS skipped (no phone)";
  if (result.status === "skipped_not_configured") return "SMS not configured";
  if (result.channel === "sms") return "SMS failed";
  if (result.channel === "whatsapp") return "WhatsApp failed";
  return "Notify failed";
}
