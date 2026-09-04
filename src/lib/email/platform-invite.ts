import "server-only";
import { ROLE_LABELS, type PlatformRole } from "@/lib/platform/permissions";
import { PLATFORM_INVITE_EXPIRY_LABEL } from "@/lib/platform/invite-ttl";
import { ResendSendError, sendEmail } from "@/lib/email/resend";
import { describeResendFailure } from "@/lib/email/resend-constants";
import { logAppError } from "@/lib/errors/logger";
import { getPublicSiteUrl } from "@/lib/site-url";
import { platformDashboardPath } from "@/lib/platform/paths";

const ROLE_CHANGED_SUBJECT = "Your Nabus Motors platform role was updated";
const TEAM_WELCOME_SUBJECT = "Welcome to Nabus Motors Platform";

type InviteEmailParams = {
  to: string;
  name: string;
  role: PlatformRole | string;
  /**
   * Prefer invite acceptance URL (`/admin/platform/invite/{token}`).
   * Staff login (`/admin`) only when the account is already fully active and
   * no pending invite exists. Never log this together with a password.
   */
  inviteUrl: string;
  /** Plaintext only at send time — never persist or log. */
  temporaryPassword?: string;
  /** When omitted, inferred from `inviteUrl` (invite path vs login). */
  linkKind?: "invite" | "login";
};

/** Role display label — Staff / Manager / Super Admin / Owner (never generic "admin"). */
export function platformRoleLabel(role: PlatformRole | string): string {
  return ROLE_LABELS[role as PlatformRole] ?? role;
}

function inviteSubject(role: PlatformRole | string): string {
  return `You're invited to Nabus Motors as ${platformRoleLabel(role)}`;
}

function credentialsSubject(role: PlatformRole | string): string {
  return `Your Nabus Motors ${platformRoleLabel(role)} account`;
}

function credentialsHeadline(
  role: PlatformRole | string,
  isInvite: boolean
): string {
  const label = platformRoleLabel(role);
  return isInvite
    ? `You're invited — set up your ${label} account`
    : `Your ${label} account is ready`;
}

type SendResult =
  | { ok: true; emailSent: true; messageId: string }
  | {
      ok: true;
      emailSent: false;
      /** Raw provider text — persisted to platform_user_invites.provider_error. */
      emailError: string;
      /** Actionable rewrite for admins, when the cause is recognised. */
      emailHint?: string;
    };

export type PlatformEmailConfig = {
  configured: boolean;
  hasApiKey: boolean;
  hasFromAddress: boolean;
  missing: string[];
};

function normalizeEnvSecret(value: string | undefined): string {
  if (!value) return "";
  return value.trim().replace(/^["']|["']$/g, "");
}

export function readResendApiKey(): string | undefined {
  const raw = normalizeEnvSecret(process.env.RESEND_API_KEY);
  if (!raw || raw === "re_xxxxxxxx") return undefined;
  return raw;
}

export function getPlatformEmailConfig(): PlatformEmailConfig {
  const apiKey = readResendApiKey();
  const hasApiKey = Boolean(apiKey);
  const explicitFrom = normalizeEnvSecret(process.env.RESEND_FROM_EMAIL);
  const hasFromAddress = Boolean(explicitFrom);
  const missing: string[] = [];
  if (!hasApiKey) missing.push("RESEND_API_KEY");
  if (!hasFromAddress) missing.push("RESEND_FROM_EMAIL");
  return {
    configured: hasApiKey && hasFromAddress,
    hasApiKey,
    hasFromAddress,
    missing,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveLinkKind(
  inviteUrl: string,
  linkKind?: "invite" | "login"
): "invite" | "login" {
  if (linkKind) return linkKind;
  return /\/invite\//i.test(inviteUrl) ? "invite" : "login";
}

function buildCredentialsHtml({
  name,
  role,
  inviteUrl,
  temporaryPassword,
  linkKind,
}: {
  name: string;
  role: string;
  inviteUrl: string;
  temporaryPassword: string;
  linkKind?: "invite" | "login";
}): string {
  const label = platformRoleLabel(role);
  const kind = resolveLinkKind(inviteUrl, linkKind);
  const isInvite = kind === "invite";
  const subject = credentialsSubject(role);
  const headline = credentialsHeadline(role, isInvite);
  const body = isInvite
    ? `You've been invited to join <strong>Nabus Motors</strong> as <strong>${escapeHtml(label)}</strong>.
                Use the temporary password below on the invitation page to activate your account.`
    : `Your <strong>Nabus Motors</strong> <strong>${escapeHtml(label)}</strong> password was updated.
                Use the temporary password below to sign in, then change it after your next login.`;
  const ctaLabel = isInvite ? "Accept invitation" : "Sign in";
  const afterNote = isInvite
    ? "This link opens your invitation. Enter the temporary password there to activate."
    : "Sign in with this temporary password, then change it after your next login.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Nabus Motors</p>
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;color:#18181b;">${headline}</h1>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">Hi ${escapeHtml(name)},</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">
                ${body}
              </p>
              <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#52525b;">
                Temporary password:
              </p>
              <p style="margin:0 0 24px;font-size:18px;line-height:1.4;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-weight:600;color:#18181b;letter-spacing:0.02em;">
                ${escapeHtml(temporaryPassword)}
              </p>
              <p style="margin:0 0 24px;text-align:center;">
                <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;border-radius:8px;">
                  ${ctaLabel}
                </a>
              </p>
              <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#52525b;">
                Or copy this link into your browser:
              </p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;word-break:break-all;color:#2563eb;">
                <a href="${escapeHtml(inviteUrl)}" style="color:#2563eb;">${escapeHtml(inviteUrl)}</a>
              </p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#52525b;">
                ${afterNote}
              </p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#71717a;">
                If you weren't expecting this email, contact the account owner before signing in.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildCredentialsText({
  name,
  role,
  inviteUrl,
  temporaryPassword,
  linkKind,
}: {
  name: string;
  role: string;
  inviteUrl: string;
  temporaryPassword: string;
  linkKind?: "invite" | "login";
}): string {
  const label = platformRoleLabel(role);
  const kind = resolveLinkKind(inviteUrl, linkKind);
  const isInvite = kind === "invite";
  return [
    `Hi ${name},`,
    "",
    isInvite
      ? `You've been invited to join Nabus Motors as ${label}.`
      : `Your Nabus Motors ${label} password was updated.`,
    "",
    `Temporary password: ${temporaryPassword}`,
    "",
    isInvite ? "Accept your invitation here:" : "Sign in here:",
    inviteUrl,
    "",
    isInvite
      ? "Enter the temporary password on the invitation page to activate."
      : "Change your password after your next login.",
    "",
    "If you weren't expecting this email, contact the account owner before signing in.",
  ].join("\n");
}

function buildInviteHtml({ name, role, inviteUrl }: InviteEmailParams): string {
  const label = platformRoleLabel(role);
  const subject = inviteSubject(role);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Nabus Motors</p>
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;color:#18181b;">You're invited as ${escapeHtml(label)}</h1>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">Hi ${escapeHtml(name)},</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">
                You've been invited to join <strong>Nabus Motors</strong> as <strong>${escapeHtml(label)}</strong>.
                Use the button below to set your password and activate your account.
              </p>
              <p style="margin:0 0 24px;text-align:center;">
                <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;border-radius:8px;">
                  Accept invitation
                </a>
              </p>
              <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#52525b;">
                Or copy this link into your browser:
              </p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;word-break:break-all;color:#2563eb;">
                <a href="${escapeHtml(inviteUrl)}" style="color:#2563eb;">${escapeHtml(inviteUrl)}</a>
              </p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#71717a;">
                This invitation expires in ${PLATFORM_INVITE_EXPIRY_LABEL}. If you weren't expecting this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildInviteText({ name, role, inviteUrl }: InviteEmailParams): string {
  const label = platformRoleLabel(role);
  return [
    `Hi ${name},`,
    "",
    `You've been invited to join Nabus Motors as ${label}.`,
    "",
    "Set your password and activate your account using this link:",
    inviteUrl,
    "",
    `This invitation expires in ${PLATFORM_INVITE_EXPIRY_LABEL}.`,
    "",
    "If you weren't expecting this email, you can safely ignore it.",
  ].join("\n");
}

/** Pure content builder — used by send + tests. Never logs secrets. */
export function buildPlatformInviteEmailContent(
  params: Omit<InviteEmailParams, "to">
): { subject: string; html: string; text: string } {
  // Do not trim — must match the exact string that was hashed for login.
  const temporaryPassword = params.temporaryPassword;
  if (temporaryPassword) {
    return {
      subject: credentialsSubject(params.role),
      html: buildCredentialsHtml({
        name: params.name,
        role: params.role,
        inviteUrl: params.inviteUrl,
        temporaryPassword,
        linkKind: params.linkKind,
      }),
      text: buildCredentialsText({
        name: params.name,
        role: params.role,
        inviteUrl: params.inviteUrl,
        temporaryPassword,
        linkKind: params.linkKind,
      }),
    };
  }

  return {
    subject: inviteSubject(params.role),
    html: buildInviteHtml(params as InviteEmailParams),
    text: buildInviteText(params as InviteEmailParams),
  };
}

async function sendPlatformStaffEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  module: string;
  context?: Record<string, unknown>;
}): Promise<SendResult> {
  try {
    const result = await sendEmail({
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return { ok: true, emailSent: true, messageId: result.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email";
    console.error(`${params.module} failed:`, message);

    const hint =
      error instanceof ResendSendError
        ? describeResendFailure(error.providerMessage, {
            fromDomain: error.fromDomain,
            fromAddress: error.fromAddress,
          })
        : describeResendFailure(message);

    logAppError({
      error,
      module: params.module,
      userMessage: "The email could not be sent.",
      kind: "external_service",
      status: 502,
      context: {
        provider: "resend",
        to: params.to,
        ...(params.context ?? {}),
        ...(error instanceof ResendSendError
          ? {
              providerMessage: error.providerMessage,
              providerCode: error.providerCode,
              statusCode: error.statusCode,
              fromAddress: error.fromAddress,
              fromDomain: error.fromDomain,
            }
          : { providerMessage: message }),
        ...(hint ? { emailHint: hint } : {}),
      },
    });

    return {
      ok: true,
      emailSent: false,
      emailError: message,
      ...(hint ? { emailHint: hint } : {}),
    };
  }
}

export async function sendPlatformInviteEmail(params: InviteEmailParams): Promise<SendResult> {
  const content = buildPlatformInviteEmailContent(params);
  return sendPlatformStaffEmail({
    to: params.to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    module: "email.platform_invite.send",
    context: {
      hasTemporaryPassword: Boolean(params.temporaryPassword?.trim()),
    },
  });
}

/** Role changed by admin — email companion to WhatsApp/SMS. */
export async function sendPlatformRoleChangedEmail(params: {
  to: string;
  name: string;
  role: PlatformRole | string;
}): Promise<SendResult> {
  const label = platformRoleLabel(params.role);
  const dashboardUrl = `${getPublicSiteUrl()}${platformDashboardPath()}`;
  const text = [
    `Hi ${params.name},`,
    "",
    `Your Nabus Motors platform role is now ${label}.`,
    "",
    `Open the dashboard: ${dashboardUrl}`,
  ].join("\n");
  const html = `<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;color:#18181b;line-height:1.6;padding:24px;">
<p>Hi ${escapeHtml(params.name)},</p>
<p>Your Nabus Motors platform role is now <strong>${escapeHtml(label)}</strong>.</p>
<p><a href="${escapeHtml(dashboardUrl)}">Open the dashboard</a></p>
</body></html>`;

  return sendPlatformStaffEmail({
    to: params.to,
    subject: ROLE_CHANGED_SUBJECT,
    html,
    text,
    module: "email.platform_role_changed.send",
  });
}

/** Self-service password change confirmation — no secrets in body. */
export async function sendPlatformPasswordChangedEmail(params: {
  to: string;
  name: string;
  when: string;
  ip?: string | null;
  securityUrl: string;
}): Promise<SendResult> {
  const { passwordChangedEmail } = await import("@/lib/email/branded-templates");
  const branded = passwordChangedEmail(params.name, {
    when: params.when,
    ip: params.ip?.trim() || undefined,
    securityUrl: params.securityUrl,
  });
  return sendPlatformStaffEmail({
    to: params.to,
    subject: branded.subject,
    html: branded.html,
    text: branded.text,
    module: "email.platform_password_changed.send",
  });
}

/** Self-serve forgot-password link — never includes a temporary password. */
export async function sendPlatformPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
  expiryLabel?: string;
}): Promise<SendResult> {
  const expiry = params.expiryLabel?.trim() || "1 hour";
  const subject = "Reset your Nabus Motors platform password";
  const text = [
    `Hi ${params.name},`,
    "",
    "We received a request to reset your Nabus Motors platform password.",
    "",
    "Set a new password using this secure link:",
    params.resetUrl,
    "",
    `This link works once and expires in ${expiry}.`,
    "If you did not request this, you can ignore this email — your password will stay the same.",
    "",
    "Nabus Motors and Trading",
  ].join("\n");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Nabus Motors</p>
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;color:#18181b;">Reset your platform password</h1>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">Hi ${escapeHtml(params.name)},</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">
                We received a request to reset your Nabus Motors platform password.
                Use the button below to choose a new password.
              </p>
              <p style="margin:0 0 24px;text-align:center;">
                <a href="${escapeHtml(params.resetUrl)}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;border-radius:8px;">
                  Set new password
                </a>
              </p>
              <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#52525b;">
                Or copy this link into your browser:
              </p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;word-break:break-all;color:#2563eb;">
                <a href="${escapeHtml(params.resetUrl)}" style="color:#2563eb;">${escapeHtml(params.resetUrl)}</a>
              </p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#71717a;">
                This link works once and expires in ${escapeHtml(expiry)}. If you did not request this, you can ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return sendPlatformStaffEmail({
    to: params.to,
    subject,
    html,
    text,
    module: "email.platform_password_reset.send",
  });
}

/** Welcome after invite accept — email companion to WhatsApp/SMS. */
export async function sendPlatformTeamWelcomeEmail(params: {
  to: string;
  name: string;
  role: PlatformRole | string;
}): Promise<SendResult> {
  const label = platformRoleLabel(params.role);
  const dashboardUrl = `${getPublicSiteUrl()}${platformDashboardPath()}`;
  const text = [
    `Hi ${params.name},`,
    "",
    `Welcome to Nabus Motors Platform. Your ${label} account is active.`,
    "",
    `Open the dashboard: ${dashboardUrl}`,
  ].join("\n");
  const html = `<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;color:#18181b;line-height:1.6;padding:24px;">
<p>Hi ${escapeHtml(params.name)},</p>
<p>Welcome to Nabus Motors Platform. Your <strong>${escapeHtml(label)}</strong> account is active.</p>
<p><a href="${escapeHtml(dashboardUrl)}">Open the dashboard</a></p>
</body></html>`;

  return sendPlatformStaffEmail({
    to: params.to,
    subject: TEAM_WELCOME_SUBJECT,
    html,
    text,
    module: "email.platform_team_welcome.send",
  });
}

/** Successful platform sign-in alert (throttled by caller). */
export async function sendPlatformLoginAlertEmail(params: {
  to: string;
  name: string;
  role: PlatformRole | string;
  when: string;
  ip?: string | null;
  device?: string | null;
  securityUrl: string;
}): Promise<SendResult> {
  const label = platformRoleLabel(params.role);
  const subject = `You signed in to your Nabus Motors ${label} account`;
  const ipLine = params.ip?.trim() ? `Approximate IP: ${params.ip.trim()}` : null;
  const deviceLine = params.device?.trim() ? `Device: ${params.device.trim()}` : null;
  const text = [
    `Hi ${params.name},`,
    "",
    `You signed in to your Nabus Motors ${label} account.`,
    "",
    `When: ${params.when}`,
    ...(deviceLine ? [deviceLine] : []),
    ...(ipLine ? [ipLine] : []),
    "",
    "If this was you, no action is needed.",
    `If this was not you, change your password here: ${params.securityUrl}`,
    "",
    "Nabus Motors and Trading",
  ].join("\n");
  const detailRows = [
    `<li><strong>When:</strong> ${escapeHtml(params.when)}</li>`,
    deviceLine
      ? `<li><strong>Device:</strong> ${escapeHtml(params.device!.trim())}</li>`
      : "",
    ipLine
      ? `<li><strong>Approximate IP:</strong> ${escapeHtml(params.ip!.trim())}</li>`
      : "",
  ]
    .filter(Boolean)
    .join("");
  const html = `<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;color:#18181b;line-height:1.6;padding:24px;">
<p>Hi ${escapeHtml(params.name)},</p>
<p>You signed in to your Nabus Motors <strong>${escapeHtml(label)}</strong> account.</p>
<ul style="padding-left:20px;">${detailRows}</ul>
<p>If this was you, no action is needed.</p>
<p><a href="${escapeHtml(params.securityUrl)}">Change password / security</a></p>
<p style="color:#71717a;font-size:13px;">If this was not you, change your password immediately and contact the owner.</p>
</body></html>`;

  return sendPlatformStaffEmail({
    to: params.to,
    subject,
    html,
    text,
    module: "email.platform_login_alert.send",
  });
}

/** Failed platform sign-in alert (throttled by caller). */
export async function sendPlatformFailedLoginAlertEmail(params: {
  to: string;
  name: string;
  role: PlatformRole | string;
  when: string;
  ip?: string | null;
  device?: string | null;
  securityUrl: string;
}): Promise<SendResult> {
  const label = platformRoleLabel(params.role);
  const subject = `Failed sign-in attempt on your Nabus Motors ${label} account`;
  const ipLine = params.ip?.trim() ? `Approximate IP: ${params.ip.trim()}` : null;
  const deviceLine = params.device?.trim() ? `Device: ${params.device.trim()}` : null;
  const text = [
    `Hi ${params.name},`,
    "",
    `Someone tried to sign in to your Nabus Motors ${label} account but did not enter the correct password.`,
    "",
    `When: ${params.when}`,
    ...(deviceLine ? [deviceLine] : []),
    ...(ipLine ? [ipLine] : []),
    "",
    "If this was not you, change your password immediately:",
    params.securityUrl,
    "",
    "Nabus Motors and Trading",
  ].join("\n");
  const detailRows = [
    `<li><strong>When:</strong> ${escapeHtml(params.when)}</li>`,
    deviceLine
      ? `<li><strong>Device:</strong> ${escapeHtml(params.device!.trim())}</li>`
      : "",
    ipLine
      ? `<li><strong>Approximate IP:</strong> ${escapeHtml(params.ip!.trim())}</li>`
      : "",
  ]
    .filter(Boolean)
    .join("");
  const html = `<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;color:#18181b;line-height:1.6;padding:24px;">
<p>Hi ${escapeHtml(params.name)},</p>
<p>Someone tried to sign in to your Nabus Motors <strong>${escapeHtml(label)}</strong> account but did not enter the correct password.</p>
<ul style="padding-left:20px;">${detailRows}</ul>
<p>If this was not you, change your password immediately.</p>
<p><a href="${escapeHtml(params.securityUrl)}">Change password / security</a></p>
</body></html>`;

  return sendPlatformStaffEmail({
    to: params.to,
    subject,
    html,
    text,
    module: "email.platform_failed_login_alert.send",
  });
}
