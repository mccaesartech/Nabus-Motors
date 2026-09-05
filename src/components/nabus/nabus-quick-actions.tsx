import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type QuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  variant?: "primary" | "secondary" | "gold";
};

type NabusQuickActionsProps = {
  actions: QuickAction[];
  className?: string;
};

const VARIANT_STYLES = {
  primary:
    "bg-[var(--nabus-primary)] text-white hover:bg-[var(--nabus-primary-hover)] border-transparent",
  secondary:
    "bg-[var(--nabus-surface)] text-[var(--nabus-charcoal)] hover:bg-[var(--nabus-background)] border-[var(--nabus-input-border)]",
  gold: "bg-[var(--nabus-yellow-light)] text-[var(--nabus-charcoal)] hover:bg-[var(--nabus-yellow)] border-transparent",
};

export function NabusQuickActions({ actions, className }: NabusQuickActionsProps) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {actions.map((action) => {
        const Icon = action.icon;
        const variant = action.variant ?? "secondary";
        return (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors duration-200",
              VARIANT_STYLES[variant]
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} />
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}
