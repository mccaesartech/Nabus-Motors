import "server-only";

/** Site setting keys that should never be returned in full to the browser. */
export const SECRET_SITE_SETTING_KEYS = [
  "whatsapp_api_access_token",
  "twilio_auth_token",
  "termii_api_key",
  "arkesel_api_key",
] as const;

export type SecretSiteSettingKey = (typeof SECRET_SITE_SETTING_KEYS)[number];

export const SECRET_MASK = "••••••••";

export function isSecretSiteSettingKey(key: string): key is SecretSiteSettingKey {
  return (SECRET_SITE_SETTING_KEYS as readonly string[]).includes(key);
}

export function maskSecretValue(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.length <= 4) return SECRET_MASK;
  return `${SECRET_MASK}${trimmed.slice(-4)}`;
}

export function looksLikeMaskedSecret(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  return trimmed.startsWith("••••") || trimmed === SECRET_MASK;
}

export function maskSettingsSecrets<T extends Record<string, string>>(settings: T): T {
  const next = { ...settings } as Record<string, string>;
  for (const key of SECRET_SITE_SETTING_KEYS) {
    if (key in next) {
      next[key] = maskSecretValue(next[key]);
    }
  }
  return next as T;
}

/** Drop masked secrets from PATCH payloads so we do not overwrite real values. */
export function stripMaskedSecretUpdates(
  updates: Record<string, string>
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (isSecretSiteSettingKey(key) && looksLikeMaskedSecret(value)) continue;
    next[key] = value;
  }
  return next;
}
