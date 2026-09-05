import { cn } from "@/lib/utils";

type NabusPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "accent" | "dark";
  className?: string;
};

export function NabusPageHeader({
  eyebrow,
  title,
  description,
  action,
  variant = "default",
  className,
}: NabusPageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-8 sm:mb-10",
        variant === "accent" &&
          "rounded-2xl border border-[var(--nabus-primary)]/15 bg-[var(--nabus-red-soft)] p-6 sm:p-8",
        variant === "dark" &&
          "rounded-2xl bg-[var(--nabus-charcoal)] p-6 text-white sm:p-8",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p
              className={cn(
                "text-xs font-bold uppercase tracking-[0.18em]",
                variant === "dark" ? "text-[var(--nabus-yellow)]" : "text-[var(--nabus-primary)]"
              )}
            >
              {eyebrow}
            </p>
          ) : null}
          <h1
            className={cn(
              "mt-1 text-[1.75rem] font-bold tracking-tight sm:text-[2rem]",
              variant === "dark" ? "text-white" : "text-[var(--nabus-charcoal)]"
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                "mt-2 max-w-2xl text-sm leading-relaxed sm:text-base",
                variant === "dark" ? "text-white/75" : "text-[var(--nabus-text-secondary)]"
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
