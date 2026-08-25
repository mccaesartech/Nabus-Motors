/**
 * Decode the `iat` claim from a compact JWT without verifying the signature.
 * Signature verification remains the auth provider's responsibility
 * (`supabase.auth.getUser`). This helper only supports revocation checks.
 */
export function parseJwtIssuedAtSeconds(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = Buffer.from(part, "base64url").toString("utf8");
    const payload = JSON.parse(json) as { iat?: unknown };
    return typeof payload.iat === "number" ? payload.iat : null;
  } catch {
    return null;
  }
}

/**
 * True when the JWT was issued before credentials were revoked
 * (password change / global sign-out).
 */
export function isJwtIssuedBeforeRevocation(
  iatSeconds: number | null,
  credentialsRevokedAt: string | Date | null | undefined
): boolean {
  if (iatSeconds == null) return false;
  if (!credentialsRevokedAt) return false;
  const revokedAtMs =
    credentialsRevokedAt instanceof Date
      ? credentialsRevokedAt.getTime()
      : Date.parse(String(credentialsRevokedAt));
  if (!Number.isFinite(revokedAtMs)) return false;
  return iatSeconds * 1000 < revokedAtMs;
}
