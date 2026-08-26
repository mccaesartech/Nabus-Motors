"use client";

import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { CurrencyCalculator } from "@/components/shared/currency-calculator";
import { useCurrency } from "@/context/currency-context";
import { ROUTES } from "@/lib/routes";
import Link from "next/link";

export function CurrencyToolsClient() {
  const { currency, ratesLoaded, ratesStale, ratesMeta } = useCurrency();

  return (
    <>
      <section className="relative bg-brand-primary py-16 sm:py-20">
        <Container>
          <p className="mb-2 text-sm font-medium uppercase tracking-wider text-white/70">
            Auto Division
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Currency converter
          </h1>
          <p className="mt-3 max-w-2xl text-base text-white/80 sm:text-lg">
            Convert between currencies using the same live USD rates that power
            vehicle and parts prices across True Goshen.
          </p>
        </Container>
      </section>

      <section className="py-12 sm:py-16">
        <Container className="max-w-3xl space-y-8">
          <SectionHeader
            title="Live conversion"
            description="Amounts convert via USD using mid-market rates refreshed about every 30 minutes."
          />
          <CurrencyCalculator
            defaultFromCurrency="USD"
            defaultToCurrency={currency}
            ratesLoaded={ratesLoaded}
            ratesStale={ratesStale}
            ratesMeta={ratesMeta}
            variant="public"
          />
          <p className="text-sm text-muted-foreground">
            Looking for vehicle financing estimates?{" "}
            <Link
              href={ROUTES.auto.financing}
              className="font-medium text-brand-primary underline-offset-4 hover:underline"
            >
              Open the financing calculator
            </Link>
            .
          </p>
        </Container>
      </section>
    </>
  );
}