import "server-only";
import { sendEmail } from "@/lib/email/resend";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendCustomerNotificationEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ emailSent: boolean; emailError?: string; resendId?: string }> {
  const html =
    params.html ??
    `<!DOCTYPE html>
<html lang="en"><body style="font-family:sans-serif;color:#18181b;line-height:1.6;">
<p style="white-space:pre-wrap;">${escapeHtml(params.text)}</p>
</body></html>`;

  try {
    const result = await sendEmail({
      to: params.to,
      subject: params.subject,
      html,
      text: params.text,
    });

    return { emailSent: true, resendId: result.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed";
    console.warn("[customer-email] Resend request failed:", message);
    return { emailSent: false, emailError: message };
  }
}
