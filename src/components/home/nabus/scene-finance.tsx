import Link from "next/link";
import { NabusFinanceCalculator } from "@/components/nabus/nabus-finance-calculator";
import { NabusSectionLabel } from "@/components/nabus/nabus-section-label";
import { NabusArc } from "@/components/nabus/nabus-arc";
import { ROUTES } from "@/lib/routes";

const DEFAULT_FINANCE_PRICE = 35000;

export function SceneFinance() {
  return (
    <section className="bg-[var(--nabus-graphite)] py-16 text-[var(--nabus-paper)] sm:py-24">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10 xl:px-12">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <NabusSectionLabel tone="dark" showArc={false}>
              Finance
            </NabusSectionLabel>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Drive now. Pay on your terms.
            </h2>
            <NabusArc className="mt-6 max-w-[160px]" variant="gold" />
            <p className="mt-6 max-w-md text-sm leading-relaxed text-white/65">
              Flexible financing for Ghana-based buyers. Estimate your monthly payment before you
              reserve — no obligation.
            </p>
            <Link
              href={ROUTES.auto.financing}
              className="mt-8 inline-flex h-11 items-center border border-[var(--nabus-gold)] px-6 text-sm font-semibold uppercase tracking-wide text-[var(--nabus-gold)] transition-colors hover:bg-[var(--nabus-gold)] hover:text-[var(--nabus-graphite)]"
            >
              Finance Centre
            </Link>
          </div>
          <div className="border border-white/10 bg-[var(--nabus-warm-graphite)] p-6 sm:p-8">
            <NabusFinanceCalculator price={DEFAULT_FINANCE_PRICE} collapsible={false} dark />
          </div>
        </div>
      </div>
    </section>
  );
}
