import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="platform-card flex flex-col items-center justify-center rounded-xl px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-md border border-[var(--platform-border)] bg-[var(--platform-bg)] text-[var(--platform-accent)]">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-[var(--platform-text)]">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-[var(--platform-text-secondary)]">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

type ModuleShellProps = {
  icon: ReactNode;
  title: string;
  description: string;
  features: string[];
};

export function ModuleShell({ icon, title, description, features }: ModuleShellProps) {
  return (
    <div className="space-y-6">
      <div className="platform-card rounded-xl p-8">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[rgba(37,99,235,0.12)] text-[var(--platform-accent)]">
            {icon}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--platform-text)]">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--platform-text-secondary)]">
              {description}
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature}
            className="platform-card rounded-lg px-4 py-3 text-sm text-[var(--platform-text-secondary)]"
          >
            <span className="mr-2 text-[var(--platform-accent)]">—</span>
            {feature}
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--platform-text-secondary)]">
        Module in active development. Core workflows will be enabled in the next release cycle.
      </p>
    </div>
  );
}
