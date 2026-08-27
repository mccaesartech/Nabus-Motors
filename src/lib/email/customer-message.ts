import "server-only";
import { getPublicSiteUrl } from "@/lib/site-url";
import { sendEmail } from "@/lib/email/resend";
import { CUSTOMER_FACING_COMPANY_NAME } from "@/lib/customer/public-branding";

type StaffMessageEmailParams = {
  to: string;
  customerName: string;
  subject: string;
  preview: string;
  /** @deprecated Ignored — customers always see company branding, never staff names/roles. */
  staffName?: string;
};

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
  const company = escapeHtml(CUSTOMER_FACING_COMPANY_NAME);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>New message from ${company}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:32px 28px;">
          <p style="margin:0 0 8px;font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">${company}</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;">You have a new message</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">Hi ${name},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.5;"><strong>${company}</strong> sent you a message about <strong>${subject}</strong>:</p>
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
  const company = CUSTOMER_FACING_COMPANY_NAME;
  return `Hi ${params.customerName},

${company} sent you a message about "${params.subject}":

${params.preview}

View and reply in your account: ${accountUrl}

${company}`;
}

export async function sendCustomerStaffMessageEmail(
  params: StaffMessageEmailParams
): Promise<{ emailSent: boolean }> {
  try {
    await sendEmail({
      to: params.to,
      subject: `New message: ${params.subject}`,
      html: buildHtml(params),
      text: buildText(params),
    });

    return { emailSent: true };
  } catch (error) {
    console.error(
      "customer message email failed:",
      error instanceof Error ? error.message : error
    );
    return { emailSent: false };
  }
}
