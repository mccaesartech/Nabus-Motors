import "server-only";
import { getPublicSiteUrl } from "@/lib/site-url";
import { getPlatformEmailConfig, readResendApiKey } from "@/lib/email/platform-invite";

type StaffMessageEmailParams = {
  to: string;
  customerName: string;
  subject: string;
  preview: string;
  staffName: string;
};

function normalizeEnvSecret(value: string | undefined): string {
  if (!value) return "";
  return value.trim().replace(/^["']|["']$/g, "");
}

function getFromAddress(): string | null {
  const from =
    normalizeEnvSecret(process.env.RESEND_FROM_EMAIL) ||
    normalizeEnvSecret(process.env.FROM_EMAIL) ||
    "True Goshen <onboarding@resend.dev>";
  return from || null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(params: StaffMessageEmailParams): string {
  const accountUrl = `${getPublicSiteUrl()}/account`;
  const name = escapeHtml(params.customerName);
  const subject = escapeHtml(params.subject);
  const preview = escapeHtml(params.preview);
  const staff = escapeHtml(params.staffName);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>New message from True Goshen Auto</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:32px 28px;">
          <p style="margin:0 0 8px;font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">True Goshen Auto</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;">You have a new message</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">Hi ${name},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.5;"><strong>${staff}</strong> sent you a message about <strong>${subject}</strong>:</p>
          <blockquote style="margin:0 0 24px;padding:16px;background:#f4f4f5;border-left:4px solid #7c3aed;border-radius:0 8px 8px 0;font-size:14px;line-height:1.5;color:#3f3f46;">${preview}</blockquote>
          <a href="${accountUrl}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View in your account</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildText(params: StaffMessageEmailParams): string {
  const accountUrl = `${getPublicSiteUrl()}/account`;
  return `Hi ${params.customerName},

${params.staffName} sent you a message about "${params.subject}":

${params.preview}

View and reply in your account: ${accountUrl}`;
}

export async function sendCustomerStaffMessageEmail(
  params: StaffMessageEmailParams
): Promise<{ emailSent: boolean }> {
  const config = getPlatformEmailConfig();
  if (!config.hasApiKey) return { emailSent: false };

  const from = getFromAddress();
  const apiKey = readResendApiKey();
  if (!from || !apiKey) return { emailSent: false };

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
        subject: `New message: ${params.subject}`,
        html: buildHtml(params),
        text: buildText(params),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("customer message email failed:", body.slice(0, 200));
      return { emailSent: false };
    }

    return { emailSent: true };
  } catch (error) {
    console.error(
      "customer message email failed:",
      error instanceof Error ? error.message : error
    );
    return { emailSent: false };
  }
}
