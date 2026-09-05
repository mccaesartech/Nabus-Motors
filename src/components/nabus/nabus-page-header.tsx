import { FoldIndex } from "@/components/fold/fold-primitives";
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
        variant === "accent" && "border-l border-[var(--nabus-gold)] bg-[var(--nabus-paper)] px-5 py-5",
        variant === "dark" && "bg-[var(--nabus-graphite)] px-5 py-6 text-[var(--nabus-paper)]",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <FoldIndex n="PAGE" tone={variant === "dark" ? "ink" : "paper"} />
          <h1
            className={cn(
              "font-display mt-2 text-[clamp(1.8rem,4vw,2.8rem)] leading-[1.1]",
              variant === "dark" ? "text-[var(--nabus-paper)]" : "text-[var(--nabus-graphite)]"
            )}
          >
            {title}
          </h1>
          {description ? (
            <p
              className={cn(
                "mt-2 max-w-xl text-sm leading-relaxed",
                variant === "dark" ? "text-white/65" : "text-[var(--nabus-muted)]"
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
