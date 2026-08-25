"use client";

import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LogoutConfirmDialog } from "@/components/platform/confirm-dialog";
import { clearPlatformHistoryGuard } from "@/lib/platform/history-guard";
import { requestPlatformLogout } from "@/lib/admin/logout-client";
import { cn } from "@/lib/utils";

type PlatformLogoutActionProps = {
  variant: "menu" | "sidebar";
  collapsed?: boolean;
  requestLogout?: typeof requestPlatformLogout;
  onRedirect?: (href: string) => void;
};

type PlatformLogoutControllerOptions = {
  requestLogout: typeof requestPlatformLogout;
  onPendingChange: (pending: boolean) => void;
  onError: (message: string) => void;
  onRedirect: (href: string) => void;
};

export function createPlatformLogoutController({
  requestLogout,
  onPendingChange,
  onError,
  onRedirect,
}: PlatformLogoutControllerOptions) {
  let pending = false;

  return {
    async run() {
      if (pending) return;

      pending = true;
      onPendingChange(true);
      onError("");
      try {
        const redirect = await requestLogout();
        onRedirect(redirect);
      } catch (cause) {
        onError(
          cause instanceof Error
            ? cause.message
            : "Log out failed. Check your connection and try again."
        );
        pending = false;
        onPendingChange(false);
      }
    },
  };
}

export function PlatformLogoutAction({
  variant,
  collapsed = false,
  requestLogout = requestPlatformLogout,
  onRedirect = (href) => {
    clearPlatformHistoryGuard();
    window.location.replace(href);
  },
}: PlatformLogoutActionProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [controller] = useState(() =>
    createPlatformLogoutController({
      requestLogout,
      onPendingChange: setPending,
      onError: setError,
      onRedirect,
    })
  );

  const icon = pending ? (
    <Loader2 className="size-4 animate-spin" aria-hidden />
  ) : (
    <LogOut className="size-4" aria-hidden />
  );
  const label = pending ? "Logging out…" : "Log out";

  function openConfirm() {
    if (pending) return;
    setConfirmOpen(true);
  }

  async function confirmLogout() {
    setConfirmOpen(false);
    await controller.run();
  }

  const confirmDialog = (
    <LogoutConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      pending={pending}
      onConfirm={confirmLogout}
      confirmLabel="Log out"
    />
  );

  if (variant === "menu") {
    return (
      <>
        <DropdownMenuItem
          closeOnClick={false}
          disabled={pending}
          onClick={openConfirm}
          data-testid="platform-menu-logout"
          className="min-h-11 cursor-pointer gap-2 px-3 py-2 text-[var(--platform-text-secondary)] focus:bg-[rgba(76,29,149,0.06)] focus:text-[var(--platform-text)]"
        >
          {icon}
          <span aria-live="polite">{label}</span>
        </DropdownMenuItem>
        {error ? (
          <p
            role="alert"
            className="max-w-64 px-3 pb-2 text-xs leading-5 text-[var(--platform-danger)]"
          >
            {error}
          </p>
        ) : null}
        {confirmDialog}
      </>
    );
  }

  return (
    <div className={cn("min-w-0", collapsed && "flex justify-center")}>
      <button
        type="button"
        onClick={openConfirm}
        disabled={pending}
        data-testid="platform-sidebar-logout"
        className={cn(
          "platform-btn-ghost min-h-11 w-full justify-start text-[var(--platform-text-secondary)]",
          collapsed ? "size-11 justify-center p-0" : "px-3"
        )}
        aria-label={label}
        title={collapsed ? label : undefined}
      >
        {icon}
        <span className={collapsed ? "sr-only" : undefined} aria-live="polite">
          {label}
        </span>
      </button>
      {error ? (
        <p
          role="alert"
          className={cn(
            "pt-1 text-xs leading-5 text-[var(--platform-danger)]",
            collapsed && "sr-only"
          )}
        >
          {error}
        </p>
      ) : null}
      {confirmDialog}
    </div>
  );
}
