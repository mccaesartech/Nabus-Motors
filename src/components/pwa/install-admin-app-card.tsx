"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, Smartphone } from "lucide-react";
import { adminLoginPath } from "@/lib/admin/paths";
import { ADMIN_PWA } from "@/lib/pwa/constants";
import { isAdminPwaInstallPath } from "@/lib/pwa/routes";
import { isIos, isStandaloneForVariant, triggerPwaInstall } from "@/lib/pwa/install-utils";

export function InstallAdminAppCard() {
  const pathname = usePathname() ?? "";
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const canInstallHere = isAdminPwaInstallPath(pathname);

  useEffect(() => {
    setInstalled(isStandaloneForVariant("admin"));
    setIos(isIos());
  }, []);

  const installApp = useCallback(async () => {
    if (ios || !canInstallHere) return;
    const result = await triggerPwaInstall("admin");
    if (result === "installed") {
      setInstalled(true);
    }
  }, [ios, canInstallHere]);

  if (installed) {
    return (
      <div className="rounded-lg border border-[var(--platform-success)]/30 bg-[rgba(16,185,129,0.08)] px-4 py-3 text-sm text-[var(--platform-text)]">
        <p className="font-medium text-[var(--platform-success)]">Admin app installed</p>
        <p className="mt-1 text-[var(--platform-text-secondary)]">
          You are using the installed Nabus Motors Admin app. Open it from your home screen for
          quick access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--platform-text-secondary)]">
        Install the admin dashboard on your phone or tablet for one-tap access, a full-screen
        workspace, and faster return visits after login.
      </p>

      {!canInstallHere ? (
        <div className="rounded-lg border border-amber-400/40 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          For a separate <strong>Nabus Motors Admin</strong> icon, install from{" "}
          <a href={adminLoginPath()} className="font-medium underline">
            {adminLoginPath()}
          </a>{" "}
          (login page) or this Settings page — not from the dashboard.
        </div>
      ) : null}

      <button
        type="button"
        onClick={installApp}
        className="platform-btn-primary inline-flex items-center gap-2"
        disabled={!canInstallHere}
      >
        <Download className="size-4" aria-hidden />
        Install Admin App
      </button>

      {ios ? (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg-secondary)] p-3 text-sm text-[var(--platform-text-secondary)]">
          <Share className="mt-0.5 size-4 shrink-0 text-[var(--platform-accent)]" aria-hidden />
          <p>
            On iPhone or iPad (Safari): open{" "}
            <a href={adminLoginPath()} className="text-[var(--platform-accent)] underline">
              {adminLoginPath()}
            </a>
            , tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. The shortcut uses
            the{" "}
            <a href={ADMIN_PWA.manifestPath} className="text-[var(--platform-accent)] underline">
              Admin manifest
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-bg-secondary)] p-3 text-sm text-[var(--platform-text-secondary)]">
          <Smartphone className="mt-0.5 size-4 shrink-0 text-[var(--platform-accent)]" aria-hidden />
          <p>
            On Chrome or Edge: use the button above, or open the browser menu (
            <strong>⋮</strong>) and choose <strong>Install app</strong> or{" "}
            <strong>Install Nabus Motors Admin</strong>. If the button does not appear, refresh this
            page and try again.
          </p>
        </div>
      )}
    </div>
  );
}
