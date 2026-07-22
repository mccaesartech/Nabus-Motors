"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, X } from "lucide-react";
import { adminLoginPath } from "@/lib/admin/paths";
import { ADMIN_PWA } from "@/lib/pwa/constants";
import { isAdminPwaInstallPath } from "@/lib/pwa/routes";
import {
  dismissInstallBannerForDays,
  dismissInstallBannerForSession,
  isIos,
  isStandaloneForVariant,
  triggerPwaInstall,
  wasBannerDismissedRecently,
} from "@/lib/pwa/install-utils";

const BENEFITS = [
  "Quick access from your home screen",
  "Full-screen admin workspace",
  "Works like a native app",
] as const;

export function InstallAdminAppBanner() {
  const pathname = usePathname() ?? "";
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const canInstallHere = isAdminPwaInstallPath(pathname);

  useEffect(() => {
    if (isStandaloneForVariant("admin") || wasBannerDismissedRecently() || !canInstallHere) return;
    setIos(isIos());
    setVisible(true);
  }, [canInstallHere]);

  const dismissForDays = useCallback(() => {
    dismissInstallBannerForDays();
    setVisible(false);
  }, []);

  const dismissForSession = useCallback(() => {
    dismissInstallBannerForSession();
    setVisible(false);
  }, []);

  const installNow = useCallback(async () => {
    if (ios || !canInstallHere) return;
    const result = await triggerPwaInstall("admin");
    if (result === "installed") {
      setVisible(false);
    }
  }, [ios, canInstallHere]);

  if (!visible) return null;

  return (
    <div
      className="relative overflow-hidden rounded-xl border-2 border-[var(--platform-accent)]/40 bg-[rgba(107,33,168,0.08)] p-5 shadow-sm"
      role="region"
      aria-labelledby="install-admin-banner-title"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-[rgba(107,33,168,0.12)]" />

      <div className="relative flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-[rgba(107,33,168,0.18)] text-[var(--platform-accent)]">
          <Download className="size-6" aria-hidden />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="install-admin-banner-title"
                className="text-base font-semibold text-[var(--platform-text)]"
              >
                Install True Goshen Admin on your device
              </h2>
              <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">
                Add the platform dashboard to your home screen for faster, app-like access every
                time you sign in.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissForDays}
              className="shrink-0 rounded-md p-1.5 text-[var(--platform-text-secondary)] hover:bg-[rgba(107,33,168,0.12)] hover:text-[var(--platform-text)]"
              aria-label="Dismiss install banner for 7 days"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <ul className="space-y-1 text-sm text-[var(--platform-text-secondary)]">
            {BENEFITS.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full bg-[var(--platform-accent)]" />
                {item}
              </li>
            ))}
          </ul>

          {ios ? (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--platform-accent)]/25 bg-[var(--platform-bg-secondary)] p-3 text-sm text-[var(--platform-text-secondary)]">
              <Share className="mt-0.5 size-4 shrink-0 text-[var(--platform-accent)]" aria-hidden />
              <p>
                On iPhone or iPad (Safari): tap <strong>Share</strong>, then{" "}
                <strong>Add to Home Screen</strong>. The shortcut uses the{" "}
                <a href={ADMIN_PWA.manifestPath} className="text-[var(--platform-accent)] underline">
                  Admin manifest
                </a>
                .
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {!ios ? (
              <button type="button" onClick={installNow} className="platform-btn-primary">
                <Download className="size-4" aria-hidden />
                Install now
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismissForSession}
              className="platform-btn-secondary inline-flex items-center gap-2"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
