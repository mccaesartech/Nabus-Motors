import "server-only";

const BRAND_BG = "#2A1F18";
const BRAND_ACCENT = "#C8541F";
const BRAND_TEXT = "#F7F0E6";

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>${title}</title></head>
<body style="margin:0;background:#f4f2f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1E1B2E;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f2f8;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e8e4f0;">
        <tr><td style="background:${BRAND_BG};padding:20px 24px;color:${BRAND_TEXT};font-size:18px;font-weight:600;">Nabus Motors</td></tr>
        <tr><td style="padding:28px 24px;">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 24px;background:#faf8fc;font-size:12px;color:#6b6478;">This message was sent by Nabus Motors. If you did not expect it, you can ignore this email.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cta(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="display:inline-block;background:${BRAND_ACCENT};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

export type BrandedEmail = { subject: string; html: string; text: string };

export type WelcomeEmailDetails = {
  registrationId?: string;
  customerId?: string;
  supportEmail?: string;
  supportPhone?: string;
};

function welcomeTrackingHtml(details?: WelcomeEmailDetails): string {
  if (!details) return "";
  const rows: string[] = [];
  if (details.registrationId) {
    rows.push(
      `<li><strong>Account reference:</strong> ${escapeHtml(details.registrationId)}</li>`
    );
  }
  if (details.customerId) {
    rows.push(
      `<li><strong>Customer ID:</strong> ${escapeHtml(details.customerId)}</li>`
    );
  }
  if (details.supportEmail) {
    rows.push(
      `<li><strong>Support email:</strong> ${escapeHtml(details.supportEmail)}</li>`
    );
  }
  if (details.supportPhone) {
    rows.push(
      `<li><strong>Support phone:</strong> ${escapeHtml(details.supportPhone)}</li>`
    );
  }
  if (rows.length === 0) return "";
  return `<p style="margin:16px 0 8px;">Keep these details for your records and when contacting us:</p><ul style="margin:0;padding-left:20px;">${rows.join("")}</ul>`;
}

function welcomeTrackingText(details?: WelcomeEmailDetails): string {
  if (!details) return "";
  const lines: string[] = [];
  if (details.registrationId) lines.push(`Account reference: ${details.registrationId}`);
  if (details.customerId) lines.push(`Customer ID: ${details.customerId}`);
  if (details.supportEmail) lines.push(`Support email: ${details.supportEmail}`);
  if (details.supportPhone) lines.push(`Support phone: ${details.supportPhone}`);
  return lines.length ? `\n\n${lines.join("\n")}` : "";
}

export function welcomeEmail(
  name: string,
  accountUrl: string,
  details?: WelcomeEmailDetails
): BrandedEmail {
  const subject = "Welcome to Nabus Motors — your account is ready";
  const html = layout(
    subject,
    `<h1 style="margin:0 0 12px;font-size:22px;">Welcome${name ? `, ${escapeHtml(name)}` : ""}</h1><p>Your Nabus Motors account has been created. You are signed in and can track pre-orders, message our team, and manage your preferences anytime.</p>${welcomeTrackingHtml(details)}${cta(accountUrl, "Open my account")}`
  );
  const text = `Welcome to Nabus Motors${name ? `, ${name}` : ""}.

Your account has been created and you are signed in.${welcomeTrackingText(details)}

Open your account: ${accountUrl}`;
  return { subject, html, text };
}

export function verifyEmail(name: string, verifyUrl: string): BrandedEmail {
  const subject = "Confirm your Nabus Motors email";
  const safeName = name ? ` ${escapeHtml(name)}` : "";
  const html = layout(
    subject,
    `<h1 style="margin:0 0 12px;font-size:22px;">Confirm your email</h1><p>Hi${safeName}, confirm your email to finish setting up your account.</p>${cta(verifyUrl, "Confirm email")}`
  );
  return { subject, html, text: `Confirm your Nabus Motors email: ${verifyUrl}` };
}

export function accountReauthCodeEmail(
  name: string,
  code: string,
  expiryMinutes: number
): BrandedEmail {
  const subject = "Your Nabus Motors verification code";
  const safeName = name ? ` ${escapeHtml(name)}` : "";
  const safeCode = escapeHtml(code);
  const html = layout(
    subject,
    `<h1 style="margin:0 0 12px;font-size:22px;">Verification code</h1><p>Hi${safeName}, use this code to confirm your identity:</p><p style="font-size:28px;font-weight:700;letter-spacing:0.2em;margin:16px 0;">${safeCode}</p><p>This code expires in ${expiryMinutes} minutes. If you did not request this, you can ignore this email.</p>`
  );
  return {
    subject,
    html,
    text: `Your Nabus Motors verification code is ${code}. It expires in ${expiryMinutes} minutes.`,
  };
}

export function passwordResetEmail(name: string, resetUrl: string): BrandedEmail {
  const subject = "Reset your Nabus Motors password";
  const safeName = name ? ` ${escapeHtml(name)}` : "";
  const html = layout(
    subject,
    `<h1 style="margin:0 0 12px;font-size:22px;">Reset your password</h1><p>Hi${safeName}, use the button below to choose a new password. This link works once and expires soon.</p>${cta(resetUrl, "Set new password")}`
  );
  return { subject, html, text: `Reset your Nabus Motors password: ${resetUrl}` };
}

export function inviteEmail(name: string, inviteUrl: string, roleLabel: string): BrandedEmail {
  const subject = "You are invited to Nabus Motors Platform";
  const safeName = name ? ` ${escapeHtml(name)}` : "";
  const html = layout(
    subject,
    `<h1 style="margin:0 0 12px;font-size:22px;">Platform invitation</h1><p>Hi${safeName}, you have been invited as <strong>${escapeHtml(roleLabel)}</strong>.</p>${cta(inviteUrl, "Accept invitation")}`
  );
  return { subject, html, text: `You are invited to Nabus Motors Platform (${roleLabel}): ${inviteUrl}` };
}

export function passwordChangedEmail(
  name: string,
  detail?: { when?: string; ip?: string; securityUrl?: string }
): BrandedEmail {
  const subject = "Your Nabus Motors password was changed";
  const safeName = name ? ` ${escapeHtml(name)}` : "";
  const when = detail?.when?.trim();
  const ip = detail?.ip?.trim();
  const securityUrl = detail?.securityUrl?.trim();
  const metaBits = [
    when ? `<li>When: ${escapeHtml(when)}</li>` : "",
    ip && ip !== "unknown" ? `<li>Approximate IP: ${escapeHtml(ip)}</li>` : "",
  ]
    .filter(Boolean)
    .join("");
  const metaList = metaBits ? `<ul>${metaBits}</ul>` : "";
  const ctaHtml = securityUrl
    ? cta(securityUrl, "Review account security")
    : "";
  const html = layout(
    subject,
    `<h1 style="margin:0 0 12px;font-size:22px;">Password changed</h1><p>Hi${safeName}, your password was changed successfully.</p>${metaList}<p>If this was not you, change your password again immediately and contact support.</p>${ctaHtml}`
  );
  const textLines = [
    `Hi${name ? ` ${name}` : ""}, your Nabus Motors password was changed successfully.`,
    when ? `When: ${when}` : "",
    ip && ip !== "unknown" ? `Approximate IP: ${ip}` : "",
    securityUrl ? `Account security: ${securityUrl}` : "",
    "If this was not you, change your password again immediately and contact support.",
  ].filter(Boolean);
  return { subject, html, text: textLines.join("\n") };
}

export function loginAlertEmail(name: string, detail: { when: string; ip?: string; device?: string }): BrandedEmail {
  const subject = "New Nabus Motors sign-in";
  const safeName = name ? ` ${escapeHtml(name)}` : "";
  const html = layout(
    subject,
    `<h1 style="margin:0 0 12px;font-size:22px;">New sign-in</h1><p>Hi${safeName}, we noticed a sign-in to your account.</p><ul><li>When: ${escapeHtml(detail.when)}</li>${detail.device ? `<li>Device: ${escapeHtml(detail.device)}</li>` : ""}${detail.ip ? `<li>IP: ${escapeHtml(detail.ip)}</li>` : ""}</ul><p>If this was not you, change your password and review active sessions in account settings.</p>`
  );
  return { subject, html, text: `New Nabus Motors sign-in at ${detail.when}. If this was not you, change your password.` };
}

export function newDeviceEmail(name: string, device: string): BrandedEmail {
  const subject = "New device signed in to Nabus Motors";
  const safeName = name ? ` ${escapeHtml(name)}` : "";
  const html = layout(
    subject,
    `<h1 style="margin:0 0 12px;font-size:22px;">New device</h1><p>Hi${safeName}, a new device signed in: <strong>${escapeHtml(device)}</strong>.</p><p>Review sessions under Account Security if this looks unfamiliar.</p>`
  );
  return { subject, html, text: `New device signed in: ${device}` };
}

export function mfaChangedEmail(name: string, enabled: boolean): BrandedEmail {
  const subject = enabled
    ? "Authenticator enabled on your Nabus Motors account"
    : "Authenticator removed from your Nabus Motors account";
  const safeName = name ? ` ${escapeHtml(name)}` : "";
  const html = layout(
    subject,
    `<h1 style="margin:0 0 12px;font-size:22px;">${enabled ? "MFA enabled" : "MFA disabled"}</h1><p>Hi${safeName}, two-factor authentication was ${enabled ? "turned on" : "turned off"} for your account.</p>`
  );
  return { subject, html, text: subject };
}
