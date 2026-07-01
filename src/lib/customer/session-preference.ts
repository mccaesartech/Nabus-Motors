/** Customer sign-in persistence preference. */
export type SessionPreference = "stay_signed_in" | "ask_each_time" | "no_save";

export const SESSION_PREFERENCE_KEY = "auth_session_preference";
export const SESSION_STARTED_AT_KEY = "auth_session_started_at";
export const SESSION_EXPIRES_AT_KEY = "auth_session_expires_at";
export const SESSION_PROMPT_PENDING_KEY = "auth_session_preference_prompt_pending";

/** Fixed 24-hour absolute session lifetime from login (all preferences). */
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const VALID_PREFERENCES = new Set<SessionPreference>([
  "stay_signed_in",
  "ask_each_time",
  "no_save",
]);

export function isSessionPreference(value: string | null | undefined): value is SessionPreference {
  return Boolean(value && VALID_PREFERENCES.has(value as SessionPreference));
}

export function getSessionPreference(): SessionPreference | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_PREFERENCE_KEY);
  return isSessionPreference(raw) ? raw : null;
}

export function setSessionPreference(preference: SessionPreference): void {
  localStorage.setItem(SESSION_PREFERENCE_KEY, preference);
}

export function hasChosenSessionPreference(): boolean {
  return getSessionPreference() !== null;
}

export function markSessionPreferencePromptPending(): void {
  localStorage.setItem(SESSION_PROMPT_PENDING_KEY, "1");
}

export function clearSessionPreferencePromptPending(): void {
  localStorage.removeItem(SESSION_PROMPT_PENDING_KEY);
}

export function isSessionPreferencePromptPending(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SESSION_PROMPT_PENDING_KEY) === "1";
}

export function shouldShowSessionPreferencePrompt(): boolean {
  return !hasChosenSessionPreference() || isSessionPreferencePromptPending();
}

export function recordSessionStart(): void {
  const now = Date.now();
  localStorage.setItem(SESSION_STARTED_AT_KEY, String(now));
  localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(now + SESSION_MAX_AGE_MS));
}

export function clearSessionTiming(): void {
  localStorage.removeItem(SESSION_STARTED_AT_KEY);
  localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
}

export function getSessionExpiresAt(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_EXPIRES_AT_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isSessionExpired(): boolean {
  const expiresAt = getSessionExpiresAt();
  if (!expiresAt) return false;
  return Date.now() >= expiresAt;
}

export function rememberMeChecked(preference: SessionPreference | null): boolean {
  return preference === "stay_signed_in";
}
