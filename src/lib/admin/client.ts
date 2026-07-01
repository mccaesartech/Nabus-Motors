import { adminLoginPath } from "@/lib/admin/paths";

/** True only when the server rejected the session — not for 5xx or network errors. */
export function isAdminAuthError(res: Response): boolean {
  return res.status === 401;
}

export type AdminApiJson = {
  ok?: boolean;
  message?: string;
  warning?: string;
  [key: string]: unknown;
};

/** Parse admin API responses, including non-JSON error bodies. */
export async function parseAdminResponse(res: Response): Promise<AdminApiJson> {
  if (res.status === 401) {
    return {
      ok: false,
      message: "Session expired. Please sign in again.",
    };
  }

  const text = await res.text();
  if (!text.trim()) {
    return {
      ok: false,
      message: res.ok ? "Empty response from server." : `Request failed (${res.status}).`,
    };
  }

  try {
    return JSON.parse(text) as AdminApiJson;
  } catch {
    return {
      ok: false,
      message: text.slice(0, 240) || `Request failed (${res.status}).`,
    };
  }
}

export function adminErrorMessage(
  json: AdminApiJson,
  fallback = "Save failed"
): string {
  if (json.warning && json.message) {
    return `${json.message} ${json.warning}`;
  }
  return json.message || json.warning || fallback;
}

export function redirectToAdminLogin(router: { push: (path: string) => void }) {
  router.push(adminLoginPath());
}

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

/** Fetch with an abort timeout — rejects with a clear message on timeout. */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function isTeamChatSetupError(message: string): boolean {
  return message.toLowerCase().includes("team chat setup required");
}
