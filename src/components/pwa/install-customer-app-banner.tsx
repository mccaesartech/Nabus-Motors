"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/container";
import { CUSTOMER_PWA } from "@/lib/pwa/constants";
import { isAdminAppPath } from "@/lib/pwa/routes";
import { ROUTES } from "@/lib/routes";
import {
  dismissCustomerInstallBannerForDays,
  dismissCustomerInstallBannerForSession,
  initDeferredInstallPromptCapture,
  isIos,
  isOtherVariantInstalled,
  isStandaloneForVariant,
  queryInstalledPwaVariants,
  requestPwaInstallPrompt,
  triggerPwaInstall,
  wasCustomerBannerDismissedRecently,
  type InstalledPwaState,
} from "@/lib/pwa/install-utils";

const BENEFITS = [
  "One-tap access from your home screen",
  "Browse vehicles and track freight faster",
  "Sign in anytime from the installed app",
] as const;

const HOMEPAGE_PATHS = new Set<string>([ROUTES.corporate.home, ROUTES.auto.home]);

export function InstallCustomerAppBanner() {
  const pathname = usePathname() ?? "";
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [installedState, setInstalledState] = useState<InstalledPwaState>({
    customer: false,
    admin: false,
  });

  const adminOnlyInstalled = isOtherVariantInstalled(installedState, "customer");

  useEffect(() => {
    async function sync() {
      if (
        isStandaloneForVariant("customer") ||
        wasCustomerBannerDismissedRecently() ||
        isAdminAppPath(pathname) ||
        !HOMEPAGE_PATHS.has(pathname)
      ) {
        return;
      }
      setIos(isIos());
      setInstalledState(await queryInstalledPwaVariants());
      setVisible(true);
    }

    initDeferredInstallPromptCapture();
    void sync();
  }, [pathname]);

  const dismissForDays = useCallback(() => {
    dismissCustomerInstallBannerForDays();
    setVisible(false);
  }, []);

  const dismissForSession = useCallback(() => {
    dismissCustomerInstallBannerForSession();
    setVisible(false);
  }, []);

  const installNow = useCallback(async () => {
    initDeferredInstallPromptCapture();

    if (ios) {
      requestPwaInstallPrompt("customer");
      return;
    }

    const result = await triggerPwaInstall("customer");
    if (result === "installed") {
      setVisible(false);
    } else if (result === "unavailable") {
      requestPwaInstallPrompt("customer");
    }
  }, [ios]);

  if (!visible) return null;

  return (
    <div
      className="border-b border-brand-cta-gold/25 bg-gradient-to-r from-brand-primary via-brand-charcoal to-brand-primary"
      role="region"
      aria-labelledby="install-customer-banner-title"
    >
      <Container className="relative py-4 sm:py-5">
        <div className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-brand-cta-gold/10" />

        <div className="relative flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-brand-cta-gold/30 bg-brand-cta-gold/10 text-brand-cta-gold">
            <Download className="size-5" aria-hidden />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="install-customer-banner-title"
                  className="text-base font-semibold text-white sm:text-lg"
                >
                  Install True Goshen App
                </h2>
                <p className="mt-1 text-sm text-white/75">
                  Add True Goshen to your home screen — no login required. Browse now and sign in
                  from the app whenever you are ready.
                </p>
              </div>
              <button
                type="button"
                onClick={dismissForDays}
                className="shrink-0 rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                aria-label="Dismiss install banner for 7 days"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <ul className="space-y-1 text-sm text-white/70">
              {BENEFITS.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-brand-cta-gold" />
                  {item}
                </li>
              ))}
            </ul>

            {adminOnlyInstalled ? (
              <div className="rounded-lg border border-brand-cta-gold/30 bg-brand-cta-gold/10 p-3 text-sm text-white/85">
                You have the <strong>Admin</strong> app installed. Install the{" "}
                <strong>customer</strong> app separately from this page — they are different home
                screen icons.
              </div>
            ) : null}

            {ios ? (
              <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/75">
                <Share className="mt-0.5 size-4 shrink-0 text-brand-cta-gold" aria-hidden />
                <p>
                  On iPhone or iPad (Safari): tap <strong>Share</strong>, then{" "}
                  <strong>Add to Home Screen</strong>. Choose <strong>True Goshen</strong> (not TG
                  Admin). The shortcut uses the{" "}
                  <a href={CUSTOMER_PWA.manifestPath} className="text-brand-cta-gold underline">
                    customer manifest
                  </a>
                  .
                </p>
              </div>
            ) : null}

            {!ios && adminOnlyInstalled ? (
              <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white/75">
                <Share className="mt-0.5 size-4 shrink-0 text-brand-cta-gold" aria-hidden />
                <p>
                  If Chrome says already installed, open <strong>⋮</strong> →{" "}
                  <strong>Install app</strong> or <strong>Add to Home screen</strong> on this home
                  page to add <strong>True Goshen</strong> alongside your Admin shortcut.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {!ios ? (
                <Button type="button" size="sm" variant="luxury" onClick={installNow}>
                  <Download className="size-4" aria-hidden />
                  Install app
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="secondary" onClick={dismissForSession}>
                Not now
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
