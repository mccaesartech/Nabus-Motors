"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { BackNav } from "@/components/shared/back-nav";
import { ROUTES } from "@/lib/routes";

const SETTINGS_LINKS = [
  {
    href: "/account/settings",
    label: "Profile",
    icon: UserRound,
    exact: true,
  },
  {
    href: "/account/settings/privacy",
    label: "Privacy & Security",
    icon: Shield,
    exact: false,
  },
];

export function AccountSettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-border pb-4">
      {SETTINGS_LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname?.startsWith(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-brand-purple/30 bg-brand-purple/10 text-brand-purple"
                : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AccountSettingsShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-8">
      <div>
        <BackNav
          label="Back"
          fallbackHref={ROUTES.corporate.account}
          preferFallback={false}
          variant="public"
        />
        <div className="mt-4">
          <AccountSectionHeader title={title} description={description} />
        </div>
      </div>
      <AccountSettingsNav />
      {children}
    </div>
  );
}
