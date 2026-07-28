import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type PlatformStatusAction = {
  label: string;
  href: string;
};

type PlatformStatusProps = {
  code?: number | string;
  icon: LucideIcon;
  title: string;
  description: string;
  reference?: string | null;
  actions?: PlatformStatusAction[];
  /** Client-only controls such as a retry button. */
  children?: React.ReactNode;
};

/**
 * Admin-theme counterpart of `StatusPage`. Uses the `--platform-*` tokens and
 * `platform-card` so error states match the rest of the dashboard.
 */
export function PlatformStatus({
  code,
  icon: Icon,
  title,
  description,
  reference,
  actions,
  children,
}: PlatformStatusProps) {
  return (
    <div className="platform-card mx-auto flex w-full max-w-lg flex-col items-center rounded-xl px-6 py-12 text-center">
      <div
        className="flex size-14 items-center justify-center rounded-full"
        style={{ backgroundColor: "color-mix(in srgb, var(--platform-accent) 12%, transparent)" }}
      >
        <Icon className="size-7" style={{ color: "var(--platform-accent)" }} aria-hidden />
      </div>

      {code ? (
        <p
          className="mt-5 text-xs font-semibold uppercase tracking-[0.2em]"
          style={{ color: "var(--platform-text-secondary)" }}
        >
          Error {code}
        </p>
      ) : null}

      <h1 className="mt-2 text-xl font-semibold">{title}</h1>

      <p
        className="mt-3 text-sm leading-relaxed"
        style={{ color: "var(--platform-text-secondary)" }}
      >
        {description}
      </p>

      {reference ? (
        <p className="mt-3 text-xs" style={{ color: "var(--platform-text-secondary)" }}>
          {reference}
        </p>
      ) : null}

      {actions?.length || children ? (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {actions?.map((action, index) => (
            <Link
              key={action.href + action.label}
              href={action.href}
              className={`min-h-11 ${index === 0 ? "platform-btn-primary" : "platform-btn-secondary"}`}
            >
              {action.label}
            </Link>
          ))}
          {children}
        </div>
      ) : null}
    </div>
  );
}
