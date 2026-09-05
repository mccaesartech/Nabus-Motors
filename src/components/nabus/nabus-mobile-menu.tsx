"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import { useLockBodyScroll } from "@/hooks/use-lock-body-scroll";

type NavLink = {
  label: string;
  href: string;
};

type NabusMobileMenuProps = {
  open: boolean;
  onClose: () => void;
  links: NavLink[];
  className?: string;
};

export function NabusMobileMenu({ open, onClose, links, className }: NabusMobileMenuProps) {
  useLockBodyScroll(open);

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        inert={!open ? true : undefined}
        className={cn(
          "fixed inset-0 z-40 bg-[var(--nabus-charcoal)]/50 transition-opacity duration-200 lg:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
          className
        )}
        onClick={onClose}
      />
      <nav
        id="nabus-mobile-nav"
        aria-label="Mobile navigation"
        inert={!open ? true : undefined}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[min(100dvw-2rem,20rem)] flex-col border-l border-[var(--nabus-border)] bg-[var(--nabus-surface)] shadow-xl transition-transform duration-200 ease-out lg:hidden",
          open ? "translate-x-0" : "pointer-events-none translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--nabus-border)] px-4 py-4">
          <Logo variant="purple" brand="auto" height={36} srcOverride="/logo.png" />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto p-4">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={onClose}
                className="block rounded-lg px-3 py-3 text-sm font-semibold text-[var(--nabus-charcoal)] transition-colors duration-200 hover:bg-[var(--nabus-background)]"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
