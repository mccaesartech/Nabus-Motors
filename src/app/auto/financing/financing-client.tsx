"use client";

import { useMemo, useState } from "react";
import { Container } from "@/components/shared/container";
import { NabusEditorialPageHero } from "@/components/nabus/nabus-editorial-page-hero";
import { FoldIndex } from "@/components/fold/fold-primitives";
import { FinancingCalculator } from "@/components/vehicle/financing-calculator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";
import { useCurrency } from "@/context/currency-context";
import { formatUsdPrice } from "@/lib/currency";
import type { PageHeroSiteContent } from "@/lib/site-content/defaults";

const INCOME_TIER_USD = [40000, 60000, 80000, 100000] as const;

const requirements = [
  "Valid government-issued identification",
  "Proof of income (pay stubs, tax returns, or bank statements)",
  "Proof of residence (utility bill or lease agreement)",
  "Minimum credit score of 580 for standard financing",
  "Down payment of 10% or more recommended",
  "Vehicle must be priced within approved loan limits",
];

type FinancingPageClientProps = {
  hero: PageHeroSiteContent;
};

export function FinancingPageClient({ hero }: FinancingPageClientProps) {
  const { currency, ratesLoaded } = useCurrency();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [income, setIncome] = useState("");
  const [credit, setCredit] = useState("");

  const incomeRanges = useMemo(
    () => [
      `Under ${formatUsdPrice(INCOME_TIER_USD[0], currency)}`,
      `${formatUsdPrice(INCOME_TIER_USD[0], currency)} - ${formatUsdPrice(INCOME_TIER_USD[1], currency)}`,
      `${formatUsdPrice(INCOME_TIER_USD[1], currency)} - ${formatUsdPrice(INCOME_TIER_USD[2], currency)}`,
      `${formatUsdPrice(INCOME_TIER_USD[2], currency)} - ${formatUsdPrice(INCOME_TIER_USD[3], currency)}`,
      `Over ${formatUsdPrice(INCOME_TIER_USD[3], currency)}`,
    ],
    [currency, ratesLoaded]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const res = await fetch("/api/inquiries/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: (form.querySelector("#firstName") as HTMLInputElement).value,
        lastName: (form.querySelector("#lastName") as HTMLInputElement).value,
        email: (form.querySelector("#email") as HTMLInputElement).value,
        phone: (form.querySelector("#phone") as HTMLInputElement).value,
        annualIncomeRange: income,
        creditScoreRange: credit,
        vehicleOfInterest: (form.querySelector("#vehicle") as HTMLInputElement).value,
        notes: (form.querySelector("#notes") as HTMLTextAreaElement).value,
      }),
    });
    if (res.ok) setSubmitted(true);
    setLoading(false);
  }

  return (
    <>
      <NabusEditorialPageHero
        title={hero.title}
        description={hero.subtitle}
      />

      <section className="bg-[var(--nabus-ivory)] py-14 sm:py-16">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div>
              <FoldIndex n="CALC" />
              <h2 className="font-display mt-3 text-3xl text-[var(--nabus-graphite)]">Monthly figure</h2>
              <p className="mt-2 mb-6 max-w-sm text-sm text-[var(--nabus-muted)]">
                Estimate a payment before you apply. Final terms follow approval.
              </p>
              <FinancingCalculator price={35000} collapsible={false} />
            </div>

            <div>
              <FoldIndex n="NEED" />
              <h2 className="font-display mt-3 text-3xl text-[var(--nabus-graphite)]">What we ask for</h2>
              <p className="mt-2 mb-6 max-w-sm text-sm text-[var(--nabus-muted)]">
                Standard papers for a Ghana finance request.
              </p>
              <ul className="space-y-3">
                {requirements.map((req) => (
                  <li key={req} className="flex gap-3 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-foreground" />
                    <span className="text-muted-foreground">{req}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8 border border-border bg-muted/50 p-5">
                <h3 className="text-sm font-semibold">Finance Information</h3>
                <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">Rates from</p>
                    <p className="font-semibold">4.9% APR</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Terms up to</p>
                    <p className="font-semibold">84 months</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pre-qualification</p>
                    <p className="font-semibold">Soft credit check</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Approval time</p>
                    <p className="font-semibold">Same business day</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-t border-border bg-muted/50 py-14 sm:py-16">
        <Container>
          <FoldIndex n="FORM" />
          <h2 className="font-display mt-3 text-3xl text-[var(--nabus-graphite)]">Finance application</h2>
          <p className="mt-2 mb-8 max-w-md text-sm text-[var(--nabus-muted)]">
            Send this through and a specialist will call within one business day.
          </p>

          {submitted ? (
            <div className="mx-auto max-w-md border border-border bg-white p-8 text-center">
              <CheckCircle2 className="mx-auto size-10 text-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Application Received</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                A finance specialist will review your application and contact you shortly.
              </p>
            </div>
          ) : (
            <form className="mx-auto max-w-2xl space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" required />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" required />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="income">Annual Income</Label>
                  <Select value={income} onValueChange={(v) => setIncome(v ?? "")}>
                    <SelectTrigger id="income">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {incomeRanges.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="credit">Credit Score Range</Label>
                  <Select value={credit} onValueChange={(v) => setCredit(v ?? "")}>
                    <SelectTrigger id="credit">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "Excellent (750+)",
                        "Good (700-749)",
                        "Fair (650-699)",
                        "Building (580-649)",
                        "Not sure",
                      ].map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vehicle">Vehicle of Interest (optional)</Label>
                <Input id="vehicle" placeholder="e.g. 2023 BMW X5" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea id="notes" rows={4} />
              </div>
              <Button type="submit" size="lg" disabled={loading}>
                {loading ? "Submitting…" : "Submit Application"}
              </Button>
            </form>
          )}
        </Container>
      </section>
    </>
  );
}
