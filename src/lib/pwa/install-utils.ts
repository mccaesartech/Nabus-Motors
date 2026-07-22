import {
  ADMIN_PWA,
  CUSTOMER_PWA,
  INSTALL_BANNER_DISMISS_DAYS,
  INSTALL_BANNER_DISMISS_KEY_ADMIN,
  INSTALL_BANNER_DISMISS_KEY_CUSTOMER,
  INSTALL_BANNER_SESSION_KEY_ADMIN,
  INSTALL_BANNER_SESSION_KEY_CUSTOMER,
  INSTALL_PROMPT_DISMISS_DAYS,
  installPromptDismissKey,
  type PwaVariant,
} from "@/lib/pwa/constants";
import { isAdminAppPath } from "@/lib/pwa/routes";

export const PWA_INSTALL_REQUEST_EVENT = "tg-pwa-install-request";
export const PWA_DEFERRED_PROMPT_EVENT = "tg-pwa-deferred-prompt";
export const PWA_INSTALL_TOAST_EVENT = "tg-pwa-install-toast";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type PwaInstallResult = "installed" | "dismissed" | "unavailable";

export type InstalledPwaState = {
  customer: boolean;
  admin: boolean;
};

type InstalledRelatedApp = {
  id?: string;
  platform?: string;
  url?: string;
};

const deferredPrompts: Record<PwaVariant, BeforeInstallPromptEvent | null> = {
  admin: null,
  customer: null,
};
const pendingInstallRequests: Record<PwaVariant, boolean> = {
  admin: false,
  customer: false,
};

let captureInitialized = false;

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

/** Which PWA variant is running in standalone mode, if any. */
export function getActivePwaVariant(): PwaVariant | null {
  if (!isStandalone() || typeof window === "undefined") return null;
  return isAdminAppPath(window.location.pathname) ? "admin" : "customer";
}

/** True only when this specific variant is the installed standalone app. */
export function isStandaloneForVariant(variant: PwaVariant): boolean {
  return getActivePwaVariant() === variant;
}

export function variantForCurrentPage(pathname?: string): PwaVariant {
  const path =
    pathname ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  return isAdminAppPath(path) ? "admin" : "customer";
}

export function getDeferredInstallPrompt(
  variant?: PwaVariant
): BeforeInstallPromptEvent | null {
  const key = variant ?? variantForCurrentPage();
  return deferredPrompts[key];
}

/** Register a single global listener for beforeinstallprompt (per-variant capture). */
export function initDeferredInstallPromptCapture(): void {
  if (typeof window === "undefined" || captureInitialized) return;
  captureInitialized = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    const variant = variantForCurrentPage();
    deferredPrompts[variant] = event as BeforeInstallPromptEvent;
    window.dispatchEvent(
      new CustomEvent(PWA_DEFERRED_PROMPT_EVENT, { detail: { variant } })
    );
  });

  window.addEventListener("appinstalled", () => {
    const variant = variantForCurrentPage();
    deferredPrompts[variant] = null;
  });
}

export function showPwaInstallToast(
  message = "Open browser menu → Install app"
): void {
  window.dispatchEvent(
    new CustomEvent(PWA_INSTALL_TOAST_EVENT, { detail: { message } })
  );
}

/**
 * Query installed web apps via getInstalledRelatedApps (Chrome/Edge Android).
 * Requires related_applications in both manifests.
 */
export async function queryInstalledPwaVariants(): Promise<InstalledPwaState> {
  const fallback: InstalledPwaState = { customer: false, admin: false };
  if (typeof navigator === "undefined" || !("getInstalledRelatedApps" in navigator)) {
    return fallback;
  }

  try {
    const nav = navigator as Navigator & {
      getInstalledRelatedApps?: () => Promise<InstalledRelatedApp[]>;
    };
    const apps = (await nav.getInstalledRelatedApps?.()) ?? [];

    const hasCustomer = apps.some(
      (app) =>
        app.id === CUSTOMER_PWA.id ||
        app.url?.endsWith(CUSTOMER_PWA.manifestPath)
    );
    const hasAdmin = apps.some(
      (app) =>
        app.id === ADMIN_PWA.id ||
        app.url?.endsWith(ADMIN_PWA.manifestPath)
    );

    return { customer: hasCustomer, admin: hasAdmin };
  } catch {
    return fallback;
  }
}

export function isOtherVariantInstalled(
  state: InstalledPwaState,
  variant: PwaVariant
): boolean {
  return variant === "customer"
    ? state.admin && !state.customer
    : state.customer && !state.admin;
}

/**
 * Trigger the native browser install dialog immediately.
 * Used by Settings banner, card, and topbar — bypasses the bottom InstallPrompt UI.
 */
export async function triggerPwaInstall(
  variant?: PwaVariant
): Promise<PwaInstallResult> {
  if (typeof window === "undefined") return "unavailable";

  const resolvedVariant = variant ?? variantForCurrentPage();
  if (isStandaloneForVariant(resolvedVariant) || isIos()) return "unavailable";

  initDeferredInstallPromptCapture();

  const prompt = deferredPrompts[resolvedVariant];
  if (!prompt) {
    showPwaInstallToast(
      resolvedVariant === "customer"
        ? "Use browser menu (⋮) → Install app, or Share → Add to Home Screen"
        : "Open browser menu (⋮) → Install True Goshen Admin"
    );
    return "unavailable";
  }

  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    deferredPrompts[resolvedVariant] = null;
    return outcome === "accepted" ? "installed" : "dismissed";
  } catch {
    deferredPrompts[resolvedVariant] = null;
    showPwaInstallToast();
    return "unavailable";
  }
}

function wasBannerDismissedRecentlyForKeys(
  sessionKey: string,
  dismissKey: string
): boolean {
  try {
    if (sessionStorage.getItem(sessionKey)) return true;
    const raw = localStorage.getItem(dismissKey);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    const ms = INSTALL_BANNER_DISMISS_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - dismissedAt < ms;
  } catch {
    return false;
  }
}

function dismissInstallBannerForSessionKey(sessionKey: string): void {
  try {
    sessionStorage.setItem(sessionKey, "1");
  } catch {
    /* ignore */
  }
}

function dismissInstallBannerForDaysKey(dismissKey: string): void {
  try {
    localStorage.setItem(dismissKey, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function wasBannerDismissedRecently(): boolean {
  return wasBannerDismissedRecentlyForKeys(
    INSTALL_BANNER_SESSION_KEY_ADMIN,
    INSTALL_BANNER_DISMISS_KEY_ADMIN
  );
}

export function wasCustomerBannerDismissedRecently(): boolean {
  return wasBannerDismissedRecentlyForKeys(
    INSTALL_BANNER_SESSION_KEY_CUSTOMER,
    INSTALL_BANNER_DISMISS_KEY_CUSTOMER
  );
}

export function dismissInstallBannerForSession(): void {
  dismissInstallBannerForSessionKey(INSTALL_BANNER_SESSION_KEY_ADMIN);
}

export function dismissCustomerInstallBannerForSession(): void {
  dismissInstallBannerForSessionKey(INSTALL_BANNER_SESSION_KEY_CUSTOMER);
}

export function dismissInstallBannerForDays(): void {
  dismissInstallBannerForDaysKey(INSTALL_BANNER_DISMISS_KEY_ADMIN);
}

export function dismissCustomerInstallBannerForDays(): void {
  dismissInstallBannerForDaysKey(INSTALL_BANNER_DISMISS_KEY_CUSTOMER);
}

export function clearInstallDismissal(variant: PwaVariant): void {
  try {
    localStorage.removeItem(installPromptDismissKey(variant));
    if (variant === "admin") {
      localStorage.removeItem(INSTALL_BANNER_DISMISS_KEY_ADMIN);
      sessionStorage.removeItem(INSTALL_BANNER_SESSION_KEY_ADMIN);
    } else {
      localStorage.removeItem(INSTALL_BANNER_DISMISS_KEY_CUSTOMER);
      sessionStorage.removeItem(INSTALL_BANNER_SESSION_KEY_CUSTOMER);
    }
  } catch {
    /* ignore */
  }
}

export function wasPromptDismissedRecently(variant: PwaVariant): boolean {
  try {
    const raw = localStorage.getItem(installPromptDismissKey(variant));
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    const ms = INSTALL_PROMPT_DISMISS_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - dismissedAt < ms;
  } catch {
    return false;
  }
}

export function consumePwaInstallPromptRequest(variant: PwaVariant): boolean {
  const pending = pendingInstallRequests[variant];
  pendingInstallRequests[variant] = false;
  return pending;
}

/** Re-show the install prompt after "Install later" or dismiss (passive bottom banner only). */
export function requestPwaInstallPrompt(variant: PwaVariant = "admin"): void {
  if (typeof window === "undefined") return;

  pendingInstallRequests[variant] = true;
  clearInstallDismissal(variant);
  window.dispatchEvent(
    new CustomEvent(PWA_INSTALL_REQUEST_EVENT, { detail: { variant } })
  );
}
