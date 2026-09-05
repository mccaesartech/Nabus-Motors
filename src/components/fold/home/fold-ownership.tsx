import Link from "next/link";
import { FoldCrease, FoldIndex } from "@/components/fold/fold-primitives";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    num: "01",
    title: "Register",
    body: "Title, roadworthy, and DVLA paperwork stay in-house after you take the keys.",
    href: `${ROUTES.corporate.services}#registration`,
  },
  {
    num: "02",
    title: "Protect",
    body: "Insurance quotes and warranty options written around the car you actually bought.",
    href: `${ROUTES.corporate.services}#insurance`,
  },
  {
    num: "03",
    title: "Support",
    body: "Parts, service advisors, and a desk that still answers after delivery day.",
    href: `${ROUTES.corporate.services}#after-sales`,
  },
] as const;

type FoldOwnershipProps = {
  className?: string;
  compact?: boolean;
};

export function FoldOwnership({ className, compact = false }: FoldOwnershipProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden border-y border-[var(--nabus-border)] bg-[var(--nabus-paper)]",
        className
      )}
    >
      <FoldCrease className="top-16 right-[-4%] left-auto w-[28%] opacity-70" />
      <div className={cn("mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8 xl:px-10", compact ? "py-12" : "py-20 sm:py-28")}>
        <FoldIndex n="06" />
        <h2 className="font-display mt-4 max-w-lg text-[clamp(1.9rem,4.4vw,3.4rem)] leading-[1.08] text-[var(--nabus-graphite)]">
          The car is only the beginning.
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--nabus-muted)]">
          Ownership at Nabus covers the paper, the cover, and the years after the handshake.
        </p>

        <ol className="mt-12 max-w-3xl space-y-0">
          {STEPS.map((step) => (
            <li key={step.num} className="border-t border-[var(--nabus-border)] last:border-b">
              <Link
                href={step.href}
                className="group grid gap-3 py-7 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-baseline"
              >
                <span className="font-display text-4xl text-[var(--nabus-wine)]">{step.num}</span>
                <div>
                  <h3 className="font-display text-2xl text-[var(--nabus-graphite)] group-hover:text-[var(--nabus-wine)]">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--nabus-muted)]">{step.body}</p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
