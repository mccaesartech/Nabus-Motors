import Link from "next/link";
import { NabusSectionLabel } from "./nabus-section-label";
import { NabusArc } from "./nabus-arc";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    num: "01",
    title: "Register",
    body: "Title transfer, roadworthy certification, and DVLA registration handled in-house.",
    href: `${ROUTES.corporate.services}#registration`,
  },
  {
    num: "02",
    title: "Protect",
    body: "Comprehensive insurance quotes and extended warranty options tailored to your vehicle.",
    href: `${ROUTES.corporate.services}#insurance`,
  },
  {
    num: "03",
    title: "Support",
    body: "After-sales care, genuine parts, and dedicated service advisors for the life of your drive.",
    href: `${ROUTES.corporate.services}#after-sales`,
  },
] as const;

type NabusOwnershipPackProps = {
  className?: string;
  tone?: "light" | "band";
};

export function NabusOwnershipPack({ className, tone = "band" }: NabusOwnershipPackProps) {
  return (
    <section
      className={cn(
        tone === "band"
          ? "border-y border-[var(--nabus-border)] bg-[var(--nabus-ivory)]"
          : "bg-transparent",
        className
      )}
    >
      <div className="mx-auto max-w-[90rem] px-4 py-16 sm:px-6 lg:px-10 xl:px-12">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-end">
          <div>
            <NabusSectionLabel>Nabus Ownership Pack</NabusSectionLabel>
            <h2 className="mt-4 max-w-md text-3xl font-semibold tracking-tight text-[var(--nabus-graphite)] sm:text-4xl">
              Everything after the keys.
            </h2>
            <NabusArc className="mt-6 hidden max-w-xs lg:block" />
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((step) => (
              <Link
                key={step.num}
                href={step.href}
                className="group block border-t border-[var(--nabus-border)] pt-6 transition-colors duration-200 hover:border-[var(--nabus-gold)]"
              >
                <span className="font-mono text-xs text-[var(--nabus-gold)]">{step.num}</span>
                <h3 className="mt-2 text-lg font-semibold text-[var(--nabus-graphite)] group-hover:text-[var(--nabus-wine)]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--nabus-muted)]">{step.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
