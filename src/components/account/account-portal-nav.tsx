"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Locker", href: "/account", exact: true },
  { label: "Reservations", href: "/account#my-preorders" },
  { label: "Orders", href: "/account?section=orders#my-orders" },
  { label: "Imports", href: "/account?section=vehicle-requests#vehicle-requests" },
  { label: "Saved", href: "/auto/garage" },
  { label: "Visit", href: "/account?section=visit#book-visit" },
  { label: "Messages", href: "/account#messages" },
  { label: "Settings", href: "/account/settings" },
];

export function AccountPortalNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Account navigation"
      className="flex gap-1 overflow-x-auto border-b border-[var(--nabus-border)] pb-px lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r-0"
    >
      <p className="mb-3 hidden font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--nabus-muted)] lg:block">
        NB / LOCKER
      </p>
      {NAV_ITEMS.map((item) => {
        const isSettings = item.href.startsWith("/account/settings");
        const active = isSettings
          ? pathname.startsWith("/account/settings")
          : item.exact
            ? pathname === "/account"
            : false;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex shrink-0 items-center px-1 py-2.5 text-sm transition-colors duration-200",
              active
                ? "text-[var(--nabus-wine)]"
                : "text-[var(--nabus-muted)] hover:text-[var(--nabus-graphite)]"
            )}
          >
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
