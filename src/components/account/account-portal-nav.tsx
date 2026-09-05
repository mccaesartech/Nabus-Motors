"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Car,
  CreditCard,
  Heart,
  Home,
  MessageSquare,
  Package,
  Settings,
  Ship,
  Wrench,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Overview", href: "/account", icon: Home, exact: true },
  { label: "My Vehicles", href: "/account#my-preorders", icon: Car },
  { label: "Orders", href: "/account?section=orders#my-orders", icon: Package },
  { label: "Imports", href: "/account?section=vehicle-requests#vehicle-requests", icon: Ship },
  { label: "Payments", href: "/account#my-preorders", icon: CreditCard },
  { label: "Saved", href: "/auto/garage", icon: Heart },
  { label: "Services", href: "/account?section=visit#book-visit", icon: Wrench },
  { label: "Messages", href: "/account#messages", icon: MessageSquare },
  { label: "Account", href: "/account/settings", icon: Settings },
];

export function AccountPortalNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Account navigation"
      className="flex gap-1 overflow-x-auto border-b border-[var(--nabus-border)] pb-px lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:pr-4"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
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
              "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors duration-200",
              active
                ? "bg-[var(--nabus-red-soft)] text-[var(--nabus-primary)]"
                : "text-[var(--nabus-text-secondary)] hover:bg-[var(--nabus-background)] hover:text-[var(--nabus-charcoal)]"
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} />
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
