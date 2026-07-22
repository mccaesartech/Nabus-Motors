"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, User } from "lucide-react";
import { PlatformLogoutAction } from "@/components/platform/platform-logout-action";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS, type PlatformRole } from "@/lib/platform/permissions";
import { cn } from "@/lib/utils";

type PlatformAccountMenuProps = {
  userName: string;
  userRole: PlatformRole;
  variant?: "topbar" | "dashboard";
  menuActions?: ReactNode;
  className?: string;
};

/** Shared, keyboard-accessible account menu for every authenticated platform shell. */
export function PlatformAccountMenu({
  userName,
  userRole,
  variant = "topbar",
  menuActions,
  className,
}: PlatformAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const roleLabel = ROLE_LABELS[userRole];
  const dashboard = variant === "dashboard";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        type="button"
        className={cn(
          "group/account flex min-h-11 min-w-11 items-center gap-2 rounded-md border border-[var(--platform-border)] bg-[var(--platform-card)] px-2 py-1.5 text-left text-sm transition-colors hover:border-[#c4b5fd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--platform-accent)]",
          dashboard && "w-full justify-between sm:w-auto sm:min-w-52",
          className
        )}
        aria-label={`Open account menu for ${userName}, ${roleLabel}`}
        aria-expanded={open}
        data-testid={`platform-account-trigger-${variant}`}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[rgba(139,92,246,0.12)] text-[var(--platform-accent)]">
          <User className="size-4" aria-hidden />
        </span>
        <span
          className={cn(
            "min-w-0 flex-1",
            variant === "topbar" ? "hidden text-left md:block" : "block"
          )}
        >
          <span className="block truncate font-medium text-[var(--platform-text)]">
            {userName}
          </span>
          <span className="block truncate text-[10px] text-[var(--platform-text-secondary)]">
            {roleLabel}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-[var(--platform-text-secondary)] transition-transform group-data-[popup-open]/account:rotate-180",
            variant === "topbar" && "hidden md:block"
          )}
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        positionerClassName="z-[100]"
        className="platform-account-menu-content min-w-56 shadow-xl ring-0"
        aria-label={`${userName} account actions`}
      >
        {menuActions}
        <PlatformLogoutAction variant="menu" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
