/** Team invite links expire 24 hours after creation or resend. */
export const PLATFORM_INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export const PLATFORM_INVITE_EXPIRY_LABEL = "24 hours";

export function computePlatformInviteExpiresAt(nowMs = Date.now()): string {
  return new Date(nowMs + PLATFORM_INVITE_TTL_MS).toISOString();
}

export function isPlatformInviteExpired(expiresAt: string, nowMs = Date.now()): boolean {
  return new Date(expiresAt).getTime() < nowMs;
}
