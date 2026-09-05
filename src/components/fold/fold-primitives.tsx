import { cn } from "@/lib/utils";

type FoldIndexProps = {
  n: string;
  className?: string;
  tone?: "paper" | "ink";
};

export function FoldIndex({ n, className, tone = "paper" }: FoldIndexProps) {
  return (
    <p
      className={cn(
        "font-mono text-[11px] tracking-[0.2em] uppercase",
        tone === "ink" ? "text-white/50" : "text-[var(--nabus-muted)]",
        className
      )}
    >
      NB / {n}
    </p>
  );
}

export function FoldRule({ className, gold }: { className?: string; gold?: boolean }) {
  return <span className={cn(gold ? "fold-rule-gold" : "fold-rule", className)} aria-hidden />;
}

export function FoldCrease({ className }: { className?: string }) {
  return <span className={cn("fold-crease", className)} aria-hidden />;
}

export function FoldLink({
  href,
  children,
  className,
  tone = "wine",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  tone?: "wine" | "paper" | "gold";
}) {
  const color =
    tone === "paper"
      ? "text-[var(--nabus-paper)] hover:text-[var(--nabus-gold)]"
      : tone === "gold"
        ? "text-[var(--nabus-gold)] hover:text-[var(--nabus-gold-bright)]"
        : "text-[var(--nabus-wine)] hover:text-[var(--nabus-crimson)]";

  return (
    <a
      href={href}
      className={cn(
        "inline-flex items-center text-[13px] font-medium tracking-wide underline decoration-current/30 underline-offset-4 transition-colors duration-200",
        color,
        className
      )}
    >
      {children}
    </a>
  );
}
