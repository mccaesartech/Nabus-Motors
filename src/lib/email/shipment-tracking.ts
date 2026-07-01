import "server-only";
import { getPublicSiteUrl } from "@/lib/site-url";
import { readResendApiKey } from "@/lib/email/platform-invite";

type ShipmentTrackingEmailParams = {
  to: string;
  customerName: string;
  trackingNumber: string;
  referenceCode?: string | null;
  originCountry?: string | null;
  destination?: string | null;
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

function buildHtml(params: ShipmentTrackingEmailParams): string {
  const trackingUrl = `${getPublicSiteUrl()}/freight-forwarding/tracking`;
  const name = escapeHtml(params.customerName);
  const tracking = escapeHtml(params.trackingNumber);
  const route =
    params.originCountry || params.destination
      ? `${escapeHtml(params.originCountry ?? "—")} → ${escapeHtml(params.destination ?? "Ghana")}`
      : null;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>Your shipment tracking number</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:32px 28px;">
          <p style="margin:0 0 8px;font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">True Goshen</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;">Your shipment is booked</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3f3f46;">Hi ${name}, your freight shipment has been booked. Save your tracking number below to follow progress.</p>
          <p style="margin:0 0 8px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Tracking number</p>
          <p style="margin:0 0 20px;font-size:20px;font-weight:700;font-family:ui-monospace,monospace;">${tracking}</p>
          ${route ? `<p style="margin:0 0 20px;font-size:14px;color:#52525b;">Route: ${route}</p>` : ""}
          <a href="${trackingUrl}" style="display:inline-block;background:#5b21b6;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">Track your shipment</a>
          <p style="margin:24px 0 0;font-size:13px;color:#71717a;line-height:1.5;">Sign in to your account to see all shipments in one place, or use your tracking number with the email or phone on this booking.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Send tracking number to customer when a quote is converted (non-blocking). */
export async function sendShipmentTrackingEmail(
  params: ShipmentTrackingEmailParams
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = readResendApiKey();
  const from = getFromAddress();
  if (!apiKey || !from) {
    return { sent: false, reason: "email_not_configured" };
  }

  const to = params.to.trim();
  if (!to) return { sent: false, reason: "missing_recipient" };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Your True Goshen tracking number: ${params.trackingNumber}`,
        html: buildHtml(params),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn("[shipment-tracking-email] send failed:", text);
      return { sent: false, reason: "send_failed" };
    }

    return { sent: true };
  } catch (err) {
    console.warn("[shipment-tracking-email] error:", err);
    return { sent: false, reason: "send_error" };
  }
}
