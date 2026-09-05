import Link from "next/link";
import { NabusFinanceCalculator } from "@/components/nabus/nabus-finance-calculator";
import { FoldIndex } from "@/components/fold/fold-primitives";
import { ROUTES } from "@/lib/routes";
import { calculateMonthlyPayment, formatPrice } from "@/lib/format";
import {
  DEFAULT_DOWN_PAYMENT_PERCENT,
  DEFAULT_GHANA_APR,
  FINANCING_TERM_MONTHS,
} from "@/lib/vehicles/financing-constants";

const SAMPLE_PRICE = 35000;

export function FoldMoney() {
  const monthly = calculateMonthlyPayment(
    SAMPLE_PRICE,
    Math.round((SAMPLE_PRICE * DEFAULT_DOWN_PAYMENT_PERCENT) / 100),
    DEFAULT_GHANA_APR,
    FINANCING_TERM_MONTHS[2]
  );

  return (
    <section className="bg-[var(--nabus-graphite)] py-20 text-[var(--nabus-paper)] sm:py-28">
      <div className="mx-auto grid max-w-[92rem] gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:px-8 xl:px-10">
        <div>
          <FoldIndex n="07" tone="ink" />
          <h2 className="font-display mt-4 text-[clamp(2rem,4.5vw,3.4rem)] leading-[1.08]">
            Money, in months.
          </h2>
          <p className="mt-8 font-display text-[clamp(2.4rem,6vw,4.2rem)] leading-none text-[var(--nabus-gold)]">
            {formatPrice(monthly)}
            <span className="ml-2 font-sans text-base tracking-normal text-white/45">/ month</span>
          </p>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/60">
            Sample on a {formatPrice(SAMPLE_PRICE)} car, {DEFAULT_DOWN_PAYMENT_PERCENT}% down, {FINANCING_TERM_MONTHS[2]} months. Final terms follow approval.
          </p>
          <Link
            href={ROUTES.auto.financing}
            className="mt-8 inline-flex h-11 items-center bg-[var(--nabus-wine)] px-6 text-sm text-[var(--nabus-paper)] transition-colors hover:bg-[var(--nabus-crimson)]"
          >
            Start a finance request
          </Link>
        </div>
        <div className="border-t border-white/15 pt-8 lg:border-t-0 lg:border-l lg:pl-12 lg:pt-0">
          <NabusFinanceCalculator price={SAMPLE_PRICE} collapsible={false} dark />
        </div>
      </div>
    </section>
  );
}
