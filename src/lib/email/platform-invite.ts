import "server-only";
import { ROLE_LABELS, type PlatformRole } from "@/lib/platform/permissions";
import { PLATFORM_INVITE_EXPIRY_LABEL } from "@/lib/platform/invite-ttl";

const INVITE_SUBJECT = "You're invited to True Goshen Admin";

type InviteEmailParams = {
  to: string;
  name: string;
  role: PlatformRole | string;
  inviteUrl: string;
};

type SendResult =
  | { ok: true; emailSent: true }
  | { ok: true; emailSent: false; emailError: string };

const DEFAULT_RESEND_FROM = "True Goshen <onboarding@resend.dev>";

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
  const raw = normalizeEnvSecret(
    process.env.RESEND_API_KEY ?? process.env.RESEND_KEY
  );
  if (!raw || raw === "re_xxxxxxxx") return undefined;
  return raw;
}

export function getPlatformEmailConfig(): PlatformEmailConfig {
  const apiKey = readResendApiKey();
  const hasApiKey = Boolean(apiKey);
  const explicitFrom =
    normalizeEnvSecret(process.env.RESEND_FROM_EMAIL) ||
    normalizeEnvSecret(process.env.FROM_EMAIL);
  const hasFromAddress = Boolean(explicitFrom || DEFAULT_RESEND_FROM);
  const missing: string[] = [];
  if (!hasApiKey) missing.push("RESEND_API_KEY");
  return {
    configured: hasApiKey,
    hasApiKey,
    hasFromAddress,
    missing,
  };
}

function getFromAddress(): string | null {
  const from =
    normalizeEnvSecret(process.env.RESEND_FROM_EMAIL) ||
    normalizeEnvSecret(process.env.FROM_EMAIL) ||
    DEFAULT_RESEND_FROM;
  return from || null;
}

function roleLabel(role: PlatformRole | string): string {
  return ROLE_LABELS[role as PlatformRole] ?? role;
}

function buildInviteHtml({ name, role, inviteUrl }: InviteEmailParams): string {
  const label = roleLabel(role);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${INVITE_SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">True Goshen</p>
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;color:#18181b;">You're invited to the admin platform</h1>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">Hi ${escapeHtml(name)},</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">
                You've been invited to join <strong>True Goshen</strong> as <strong>${escapeHtml(label)}</strong>.
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
  const label = roleLabel(role);
  return [
    `Hi ${name},`,
    "",
    `You've been invited to join True Goshen as ${label}.`,
    "",
    "Set your password and activate your account using this link:",
    inviteUrl,
    "",
    `This invitation expires in ${PLATFORM_INVITE_EXPIRY_LABEL}.`,
    "",
    "If you weren't expecting this email, you can safely ignore it.",
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendPlatformInviteEmail(params: InviteEmailParams): Promise<SendResult> {
  const config = getPlatformEmailConfig();
  if (!config.hasApiKey) {
    return {
      ok: true,
      emailSent: false,
      emailError: "Email is not configured (RESEND_API_KEY missing). Copy the invite link to share manually.",
    };
  }

  const from = getFromAddress();
  if (!from) {
    return {
      ok: true,
      emailSent: false,
      emailError: "Email sender is not configured (RESEND_FROM_EMAIL or FROM_EMAIL missing).",
    };
  }

  const apiKey = readResendApiKey()!;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: INVITE_SUBJECT,
        html: buildInviteHtml(params),
        text: buildInviteText(params),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      let message = `Resend API error (${response.status})`;
      try {
        const parsed = JSON.parse(body) as { message?: string };
        if (parsed.message) message = parsed.message;
      } catch {
        if (body) message = body.slice(0, 200);
      }
      console.error("platform invite email failed:", message);
      return { ok: true, emailSent: false, emailError: message };
    }

    return { ok: true, emailSent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send invite email";
    console.error("platform invite email failed:", message);
    return { ok: true, emailSent: false, emailError: message };
  }
}
