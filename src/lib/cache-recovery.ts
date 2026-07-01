export const RELOAD_KEY = "tg-reload-attempts";
export const BUILD_KEY = "tg-build-id";
export const BUILD_RELOAD_KEY = "tg-build-reloaded-for";
export const SW_CLEANUP_KEY = "tg-sw-cleanup";
const MAX_RELOAD_ATTEMPTS = 2;
let reloadPending = false;

function failureMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  if (reason && typeof reason === "object" && "message" in reason) {
    return String((reason as { message: unknown }).message);
  }
  return "";
}

export function isChunkLoadFailure(reason: unknown): boolean {
  const message = failureMessage(reason);
  return (
    message.includes("ChunkLoadError") ||
    message.includes("Loading chunk") ||
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("Failed to load script") ||
    message.includes("dynamically imported module")
  );
}

export function isRecoverableLoadFailure(reason: unknown): boolean {
  return isChunkLoadFailure(reason);
}

export function isNextStaticChunkRequest(url: string): boolean {
  return url.includes("/_next/static/");
}

export function hasExceededReloadAttempts(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const attempt = Number(sessionStorage.getItem(RELOAD_KEY) ?? "0");
    return attempt >= MAX_RELOAD_ATTEMPTS;
  } catch {
    return true;
  }
}

/** Escalating reload: soft reload first, then cache-busted navigation. */
export function reloadForStaleCache(): boolean {
  if (typeof window === "undefined") return false;
  if (reloadPending) return true;

  const attempt = Number(sessionStorage.getItem(RELOAD_KEY) ?? "0");
  if (attempt >= MAX_RELOAD_ATTEMPTS) return false;

  sessionStorage.setItem(RELOAD_KEY, String(attempt + 1));
  reloadPending = true;

  if (attempt === 0) {
    window.location.reload();
  } else {
    const url = new URL(window.location.href);
    url.searchParams.set("_tg_cb", String(Date.now()));
    window.location.replace(url.toString());
  }

  return true;
}

/** Attempt auto-recovery before React error UI renders. Returns true if reloading. */
export function attemptRecoverFromLoadFailure(reason: unknown): boolean {
  if (typeof window === "undefined") return false;
  if (!isRecoverableLoadFailure(reason)) return false;
  return reloadForStaleCache();
}

export function clearReloadAttempts(): void {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    // ignore
  }
}

export function stripCacheBustParam(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("_tg_cb")) return;
    url.searchParams.delete("_tg_cb");
    window.history.replaceState({}, "", url.toString());
  } catch {
    // ignore
  }
}

export function getBuildIdFromDom(): string | null {
  if (typeof document === "undefined") return null;
  return (
    document.querySelector('meta[name="tg-build-id"]')?.getAttribute("content") ??
    null
  );
}

/** After a deploy, cached HTML may reference removed chunks — reload once per new build. */
export function checkBuildVersion(): boolean {
  if (typeof window === "undefined") return false;

  const current = getBuildIdFromDom();
  if (!current || current === "dev") return false;

  try {
    const stored = localStorage.getItem(BUILD_KEY);
    if (!stored) {
      localStorage.setItem(BUILD_KEY, current);
      return false;
    }
    if (stored === current) return false;

    const alreadyReloadedFor = sessionStorage.getItem(BUILD_RELOAD_KEY);
    if (alreadyReloadedFor === current) return false;

    sessionStorage.setItem(BUILD_RELOAD_KEY, current);
    localStorage.setItem(BUILD_KEY, current);
    return reloadForStaleCache();
  } catch {
    // ignore localStorage errors (private mode quotas, etc.)
  }

  return false;
}

/** Remove legacy service workers that can pin old bundles after deploys. */
export async function unregisterStaleServiceWorkers(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }

  try {
    if (sessionStorage.getItem(SW_CLEANUP_KEY)) return false;
  } catch {
    // ignore
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) return false;

    await Promise.all(registrations.map((reg) => reg.unregister()));

    try {
      sessionStorage.setItem(SW_CLEANUP_KEY, "1");
    } catch {
      // ignore
    }

    if (navigator.serviceWorker.controller) {
      return reloadForStaleCache();
    }
  } catch {
    // ignore
  }

  return false;
}

/** Patch fetch so failed static chunk requests trigger reload instead of error boundaries. */
export function patchFetchForStaleCache(): () => void {
  if (typeof window === "undefined") return () => {};

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    try {
      const response = await originalFetch(input, init);

      if (!response.ok && isNextStaticChunkRequest(url)) {
        reloadForStaleCache();
      }

      return response;
    } catch (error) {
      if (isNextStaticChunkRequest(url) && isRecoverableLoadFailure(error)) {
        reloadForStaleCache();
      }
      throw error;
    }
  };

  return () => {
    window.fetch = originalFetch;
  };
}
