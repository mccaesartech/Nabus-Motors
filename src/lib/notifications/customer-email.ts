import "server-only";
import { getPlatformEmailConfig, readResendApiKey } from "@/lib/email/platform-invite";
import { isResendSandboxFrom } from "@/lib/email/resend-constants";

export { isResendSandboxFrom } from "@/lib/email/resend-constants";

function getFromAddress(): string | null {
  const from =
    process.env.RESEND_FROM_EMAIL?.trim().replace(/^["']|["']$/g, "") ||
    process.env.FROM_EMAIL?.trim().replace(/^["']|["']$/g, "") ||
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

export async function sendCustomerNotificationEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ emailSent: boolean; emailError?: string; resendId?: string }> {
  const config = getPlatformEmailConfig();
  if (!config.hasApiKey) {
    return {
      emailSent: false,
      emailError: "Email not configured (RESEND_API_KEY missing).",
    };
  }

  const from = getFromAddress();
  const apiKey = readResendApiKey();
  if (!from || !apiKey) {
    return { emailSent: false, emailError: "Email sender not configured." };
  }

  if (isResendSandboxFrom(from)) {
    const sandboxError =
      "RESEND_FROM_EMAIL uses @resend.dev sandbox — only the Resend account owner receives mail. Verify your domain at resend.com/domains.";
    console.warn(`[customer-email] ${sandboxError}`);
    return { emailSent: false, emailError: sandboxError };
  }

  const html = `<!DOCTYPE html>
<html lang="en"><body style="font-family:sans-serif;color:#18181b;line-height:1.6;">
<p style="white-space:pre-wrap;">${escapeHtml(params.text)}</p>
</body></html>`;

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
        subject: params.subject,
        html,
        text: params.text,
      }),
    });

    const body = await response.text();

    if (!response.ok) {
      let message = `Resend error (${response.status})`;
      try {
        const parsed = JSON.parse(body) as { message?: string };
        if (parsed.message) message = parsed.message;
      } catch {
        if (body) message = body.slice(0, 200);
      }
      console.warn("[customer-email] Resend failed:", {
        to: params.to,
        from,
        status: response.status,
        message,
      });
      return { emailSent: false, emailError: message };
    }

    let resendId: string | undefined;
    try {
      const parsed = JSON.parse(body) as { id?: string };
      resendId = parsed.id;
    } catch {
      // Non-JSON success body
    }

    console.info("[customer-email] Resend accepted:", {
      to: params.to,
      from,
      resendId: resendId ?? "unknown",
    });

    return { emailSent: true, resendId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed";
    console.warn("[customer-email] Resend request error:", { to: params.to, from, message });
    return { emailSent: false, emailError: message };
  }
}
