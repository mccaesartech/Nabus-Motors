import { DELETION_REASONS } from "@/lib/customer/account-lifecycle.shared";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidDeleteConfirmation(
  confirmation: string,
  userEmail: string
): boolean {
  const trimmed = confirmation.trim();
  if (trimmed === "DELETE") return true;
  return normalizeEmail(trimmed) === normalizeEmail(userEmail);
}

export function isValidDeletionReason(value: string): boolean {
  return (DELETION_REASONS as readonly string[]).includes(value);
}
