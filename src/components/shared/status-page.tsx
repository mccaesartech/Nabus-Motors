import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StatusPageAction = {
  label: string;
  href: string;
  variant?: "default" | "outline";
};

type StatusPageProps = {
  /** HTTP status shown above the title, e.g. 404. Omit for non-HTTP states. */
  code?: number | string;
  icon: LucideIcon;
  title: string;
  description: string;
  /** Support reference line, e.g. "Reference TG-7K3QP2". */
  reference?: string | null;
  actions?: StatusPageAction[];
  /** Client-only controls such as a retry button. */
  children?: React.ReactNode;
  className?: string;
};

/**
 * Shared on-brand layout for every non-happy-path surface (404/401/403/503,
 * maintenance, offline). Renders inside the public shell, so it does not repeat
 * the header, footer, or logo.
 */
export function StatusPage({
  code,
  icon: Icon,
  title,
  description,
  reference,
  actions,
  children,
  className,
}: StatusPageProps) {
  return (
    <section
      className={cn(
        "mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center",
        className
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-7" aria-hidden />
      </div>

      {code ? (
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Error {code}
        </p>
      ) : null}

      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>

      {reference ? (
        <p className="mt-3 text-xs text-muted-foreground/80">{reference}</p>
      ) : null}

      {actions?.length || children ? (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {actions?.map((action) => {
            const external = /^https?:\/\//i.test(action.href);
            return (
              <Button
                key={action.href + action.label}
                variant={action.variant ?? "default"}
                render={
                  external ? (
                    <a href={action.href} target="_blank" rel="noopener noreferrer" />
                  ) : (
                    <Link href={action.href} />
                  )
                }
              >
                {action.label}
              </Button>
            );
          })}
          {children}
        </div>
      ) : null}
    </section>
  );
}
