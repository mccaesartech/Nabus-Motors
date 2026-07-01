import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AccountEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
};

export function AccountEmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
}: AccountEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-brand-purple/25 bg-gradient-to-br from-brand-purple/5 to-brand-gold/5 px-6 py-10 text-center",
        className
      )}
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && actionHref && (
        <Button render={<Link href={actionHref} />} className="mt-5 min-h-11 px-6">
          {actionLabel}
        </Button>
      )}
      {actionLabel && onAction && !actionHref && (
        <Button type="button" onClick={onAction} className="mt-5 min-h-11 px-6">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
