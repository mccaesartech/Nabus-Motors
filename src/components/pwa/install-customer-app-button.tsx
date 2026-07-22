"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  initDeferredInstallPromptCapture,
  isIos,
  isOtherVariantInstalled,
  isStandaloneForVariant,
  queryInstalledPwaVariants,
  requestPwaInstallPrompt,
  triggerPwaInstall,
  type InstalledPwaState,
} from "@/lib/pwa/install-utils";

type InstallCustomerAppButtonProps = {
  /** full = icon + label, compact = icon with screen-reader text, footer = text link style */
  display?: "full" | "compact" | "footer";
  className?: string;
  onAfterClick?: () => void;
};

export function InstallCustomerAppButton({
  display = "full",
  className,
  onAfterClick,
}: InstallCustomerAppButtonProps) {
  const [hidden, setHidden] = useState(true);
  const [installedState, setInstalledState] = useState<InstalledPwaState>({
    customer: false,
    admin: false,
  });

  useEffect(() => {
    async function sync() {
      if (isStandaloneForVariant("customer")) {
        setHidden(true);
        return;
      }
      setHidden(false);
      const state = await queryInstalledPwaVariants();
      setInstalledState(state);
    }

    initDeferredInstallPromptCapture();
    void sync();
  }, []);

  const adminOnlyInstalled = isOtherVariantInstalled(installedState, "customer");

  const install = useCallback(async () => {
    initDeferredInstallPromptCapture();

    if (isIos()) {
      requestPwaInstallPrompt("customer");
      onAfterClick?.();
      return;
    }

    const result = await triggerPwaInstall("customer");
    if (result === "installed") {
      setHidden(true);
    } else if (result === "unavailable") {
      requestPwaInstallPrompt("customer");
    }
    onAfterClick?.();
  }, [onAfterClick]);

  if (hidden) return null;

  if (display === "footer") {
    return (
      <button
        type="button"
        onClick={install}
        title={
          adminOnlyInstalled
            ? "Admin app is installed — add the customer app separately"
            : undefined
        }
        className={cn(
          "inline-flex min-h-9 items-center text-sm text-white/80 transition-colors duration-200 hover:text-brand-cta-gold",
          className
        )}
      >
        {adminOnlyInstalled ? "Install customer app" : "Install our app"}
      </button>
    );
  }

  if (display === "compact") {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={cn("w-full", className)}
        onClick={install}
      >
        <Download className="size-3.5" aria-hidden />
        {adminOnlyInstalled ? "Install customer app" : "Install app"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "text-white/80 hover:bg-white/5 hover:text-brand-gold",
        className
      )}
      onClick={install}
    >
      <Download className="size-3.5" aria-hidden />
      <span className="hidden xl:inline">
        {adminOnlyInstalled ? "Install customer app" : "Install app"}
      </span>
      <span className="sr-only xl:hidden">
        {adminOnlyInstalled ? "Install customer app" : "Install app"}
      </span>
    </Button>
  );
}
