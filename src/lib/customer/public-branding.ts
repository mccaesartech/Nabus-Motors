/**
 * Customer-facing identity for outbound messages, emails, SMS, WhatsApp,
 * and in-app chat. Never expose internal roles (owner, manager, staff, etc.).
 */
export const CUSTOMER_FACING_BRAND = "True Goshen";
export const CUSTOMER_FACING_COMPANY_NAME = "True Goshen Company Limited";

/** Display name shown to customers for any staff-originated message. */
export function customerFacingStaffSenderName(): string {
  return CUSTOMER_FACING_COMPANY_NAME;
}

/** In-app / email notification title for staff replies. */
export function customerFacingStaffReplyTitle(): string {
  return `Reply from ${CUSTOMER_FACING_BRAND}`;
}

/**
 * Sanitize already-stored customer notification titles that leaked roles
 * (e.g. "Reply from Owner" -> "Reply from True Goshen").
 */
export function sanitizeCustomerNotificationTitle(title: string): string {
  const trimmed = title.trim();
  if (/^reply from\b/i.test(trimmed)) {
    // Always brand staff replies as the company — never show role or personal name.
    return customerFacingStaffReplyTitle();
  }
  return trimmed;
}
