"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminLoginPath } from "@/lib/admin/paths";
import {
  ADMIN_PWA,
  CUSTOMER_PWA,
  INSTALL_PROMPT_DISMISS_DAYS,
  installPromptDismissKey,
  type PwaVariant,
} from "@/lib/pwa/constants";
import { isAdminAppPath, isAdminPwaInstallPath } from "@/lib/pwa/routes";
import {
  consumePwaInstallPromptRequest,
  getDeferredInstallPrompt,
  initDeferredInstallPromptCapture,
  isIos,
  isOtherVariantInstalled,
  isStandaloneForVariant,
  PWA_DEFERRED_PROMPT_EVENT,
  PWA_INSTALL_REQUEST_EVENT,
  queryInstalledPwaVariants,
  type BeforeInstallPromptEvent,
  type InstalledPwaState,
} from "@/lib/pwa/install-utils";

function wasDismissedRecently(variant: PwaVariant): boolean {
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

function rememberDismissal(variant: PwaVariant) {
  try {
    localStorage.setItem(installPromptDismissKey(variant), String(Date.now()));
  } catch {
    /* ignore */
  }
}

type InstallPromptProps = {
  variant?: PwaVariant;
};

export function InstallPrompt({ variant: variantProp }: InstallPromptProps = {}) {
  const pathname = usePathname() ?? "";
  const variant: PwaVariant =
    variantProp ?? (isAdminAppPath(pathname) ? "admin" : "customer");
  const shouldRender = !(variant === "customer" && isAdminAppPath(pathname));
  const wrongAdminInstallUrl = variant === "admin" && !isAdminPwaInstallPath(pathname);

  const copy = useMemo(() => {
    if (variant === "admin") {
      return {
        title: "Install True Goshen Admin",
        body: "Open the platform dashboard from your home screen with a secure, app-like experience.",
        benefits: [
          "Quick access to inventory and operations",
          "Full-screen admin workspace",
          "Faster return visits after login",
        ],
      };
    }
    return {
      title: "Install True Goshen",
      body: "Browse vehicles, track freight, and shop parts with a faster, app-like experience.",
      benefits: [
        "One-tap access from your home screen",
        "Smoother browsing on mobile",
        "Works when your connection is slow",
      ],
    };
  }, [variant]);

  const [hasDeferredPrompt, setHasDeferredPrompt] = useState(false);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [installedState, setInstalledState] = useState<InstalledPwaState>({
    customer: false,
    admin: false,
  });

  const otherVariantInstalled = isOtherVariantInstalled(installedState, variant);

  const refreshInstallState = useCallback(async () => {
    setHasDeferredPrompt(Boolean(getDeferredInstallPrompt(variant)));
    const state = await queryInstalledPwaVariants();
    setInstalledState(state);
  }, [variant]);

  const showPrompt = useCallback(() => {
    if (isStandaloneForVariant(variant)) return;

    if (isIos()) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    setVisible(true);
  }, [variant]);

  useEffect(() => {
    initDeferredInstallPromptCapture();
    void refreshInstallState();
  }, [refreshInstallState]);

  useEffect(() => {
    if (isStandaloneForVariant(variant) || wasDismissedRecently(variant)) return;
    if (variant === "customer" && isAdminAppPath(pathname)) return;
    if (variant === "admin" && !isAdminPwaInstallPath(pathname)) return;
    showPrompt();
  }, [showPrompt, variant, pathname]);

  useEffect(() => {
    function onDeferredPrompt(event: Event) {
      const detail = (event as CustomEvent<{ variant?: PwaVariant }>).detail;
      if (detail?.variant && detail.variant !== variant) return;

      setHasDeferredPrompt(Boolean(getDeferredInstallPrompt(variant)));
      if (
        !wasDismissedRecently(variant) &&
        !isStandaloneForVariant(variant) &&
        !(variant === "customer" && isAdminAppPath(pathname)) &&
        !(variant === "admin" && !isAdminPwaInstallPath(pathname))
      ) {
        setVisible(true);
      }
    }

    function onInstallRequest(event: Event) {
      const detail = (event as CustomEvent<{ variant?: PwaVariant }>).detail;
      if (detail?.variant && detail.variant !== variant) return;
      consumePwaInstallPromptRequest(variant);
      showPrompt();
    }

    window.addEventListener(PWA_DEFERRED_PROMPT_EVENT, onDeferredPrompt);
    window.addEventListener(PWA_INSTALL_REQUEST_EVENT, onInstallRequest);
    if (consumePwaInstallPromptRequest(variant)) {
      showPrompt();
    }
    return () => {
      window.removeEventListener(PWA_DEFERRED_PROMPT_EVENT, onDeferredPrompt);
      window.removeEventListener(PWA_INSTALL_REQUEST_EVENT, onInstallRequest);
    };
  }, [showPrompt, variant, pathname]);

  const dismiss = useCallback(() => {
    rememberDismissal(variant);
    setVisible(false);
  }, [variant]);

  const installLater = useCallback(() => {
    dismiss();
  }, [dismiss]);

  const install = useCallback(async () => {
    const prompt = getDeferredInstallPrompt(variant) as BeforeInstallPromptEvent | null;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setHasDeferredPrompt(false);
    if (outcome === "accepted") {
      setVisible(false);
    }
  }, [variant]);

  if (!visible || !shouldRender) return null;

  const manifestHref =
    variant === "admin" ? ADMIN_PWA.manifestPath : CUSTOMER_PWA.manifestPath;

  const showManualAndroid =
    !iosHint && (!hasDeferredPrompt || otherVariantInstalled);

  return (
    <div
      className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-md rounded-xl border border-border bg-card p-4 shadow-luxury-lg sm:inset-x-auto sm:right-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
      aria-describedby="pwa-install-desc"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Download className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 id="pwa-install-title" className="text-sm font-semibold text-foreground">
              {copy.title}
            </h2>
            <button
              type="button"
              onClick={dismiss}
              className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Dismiss install prompt"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <p id="pwa-install-desc" className="mt-1 text-sm text-muted-foreground">
            {copy.body}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {copy.benefits.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>

          {variant === "customer" && otherVariantInstalled ? (
            <div className="mt-3 rounded-lg border border-amber-300/60 bg-amber-50 p-2 text-xs text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-100">
              <p>
                You have the <strong>Admin</strong> app installed. Install the{" "}
                <strong>customer</strong> app separately from this home page — they are two
                different apps with different icons.
              </p>
            </div>
          ) : null}

          {variant === "admin" && otherVariantInstalled ? (
            <div className="mt-3 rounded-lg border border-amber-300/60 bg-amber-50 p-2 text-xs text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-100">
              <p>
                You have the <strong>customer</strong> app installed. Install{" "}
                <strong>True Goshen Admin</strong> separately from{" "}
                <a href={adminLoginPath()} className="font-medium underline">
                  {adminLoginPath()}
                </a>{" "}
                for a dedicated admin icon.
              </p>
            </div>
          ) : null}

          {wrongAdminInstallUrl ? (
            <div className="mt-3 rounded-lg border border-amber-300/60 bg-amber-50 p-2 text-xs text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-100">
              <p>
                Install <strong>True Goshen Admin</strong> from{" "}
                <a href={adminLoginPath()} className="font-medium underline">
                  {adminLoginPath()}
                </a>{" "}
                so your device registers the platform app separately from the customer site.
              </p>
            </div>
          ) : null}

          {iosHint ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
              <Share className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <p>
                {variant === "admin" ? (
                  <>
                    On iPhone or iPad: open this platform page in Safari, tap{" "}
                    <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
                  </>
                ) : (
                  <>
                    On iPhone or iPad: open the True Goshen home page in Safari, tap{" "}
                    <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
                  </>
                )}{" "}
                {otherVariantInstalled && variant === "customer" ? (
                  <>
                    If you already have the Admin shortcut, add this one too — choose{" "}
                    <strong>True Goshen</strong> (not TG Admin).
                  </>
                ) : null}{" "}
                The shortcut uses the{" "}
                <a href={manifestHref} className="underline">
                  {variant === "admin" ? "Admin" : "Customer"} manifest
                </a>
                . On iOS, only one PWA per domain may be supported on older versions.
              </p>
            </div>
          ) : null}

          {showManualAndroid ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
              <Share className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <p>
                {variant === "customer" ? (
                  <>
                    If the browser says the app is already installed, it may mean only the{" "}
                    <strong>Admin</strong> app is on your home screen. Open this home page in
                    Chrome, tap <strong>⋮</strong>, then <strong>Install app</strong> or{" "}
                    <strong>Add to Home screen</strong> to add <strong>True Goshen</strong>{" "}
                    separately.
                  </>
                ) : (
                  <>
                    This browser did not offer automatic installation. In Chrome or Edge, open{" "}
                    <strong>⋮</strong> and choose{" "}
                    <strong>Install True Goshen Admin</strong> or <strong>Install app</strong>.
                  </>
                )}
              </p>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {!iosHint && hasDeferredPrompt && !otherVariantInstalled ? (
              <Button type="button" size="sm" className="min-h-11" onClick={install}>
                Install app
              </Button>
            ) : null}
            {!iosHint && hasDeferredPrompt && otherVariantInstalled ? (
              <Button type="button" size="sm" className="min-h-11" onClick={install}>
                Install anyway
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={installLater}
            >
              Install later
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
