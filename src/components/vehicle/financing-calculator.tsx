"use client";

import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { calculateMonthlyPayment } from "@/lib/format";
import { useCurrency } from "@/context/currency-context";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DEFAULT_DOWN_PAYMENT_PERCENT,
  DEFAULT_GHANA_APR,
  FINANCING_APR_OPTIONS,
  FINANCING_TERM_MONTHS,
} from "@/lib/vehicles/financing-constants";

interface FinancingCalculatorProps {
  price: number;
  /** When false, content is always visible (e.g. financing page). */
  collapsible?: boolean;
}

export function FinancingCalculator({
  price,
  collapsible = true,
}: FinancingCalculatorProps) {
  const { formatPrice } = useCurrency();
  const [downPaymentPercent, setDownPaymentPercent] = useState(
    DEFAULT_DOWN_PAYMENT_PERCENT
  );
  const [term, setTerm] = useState(String(FINANCING_TERM_MONTHS[2]));
  const [rate, setRate] = useState(String(DEFAULT_GHANA_APR));

  const downPayment = useMemo(
    () => Math.round((price * downPaymentPercent) / 100),
    [price, downPaymentPercent]
  );

  const monthly = calculateMonthlyPayment(
    price,
    downPayment,
    Number(rate),
    Number(term)
  );

  const calculatorBody = (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <Label>Down Payment ({downPaymentPercent}%)</Label>
          <span className="font-medium">{formatPrice(downPayment)}</span>
        </div>
        <Slider
          value={[downPaymentPercent]}
          min={0}
          max={50}
          step={5}
          onValueChange={(v) => {
            const value = Array.isArray(v) ? v[0] : v;
            if (typeof value === "number") setDownPaymentPercent(value);
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Term</Label>
          <Select value={term} onValueChange={(v) => setTerm(v ?? String(FINANCING_TERM_MONTHS[2]))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FINANCING_TERM_MONTHS.map((t) => (
                <SelectItem key={t} value={String(t)}>
                  {t} months
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Interest Rate</Label>
          <Select value={rate} onValueChange={(v) => setRate(v ?? String(DEFAULT_GHANA_APR))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FINANCING_APR_OPTIONS.map((r) => (
                <SelectItem key={r} value={String(r)}>
                  {r}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">Estimated Monthly Payment</p>
        <p className="text-2xl font-semibold text-foreground">
          {formatPrice(monthly)}
          <span className="text-sm font-normal text-muted-foreground">/mo</span>
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Estimates in GHS. Actual rates from partner lenders may vary.
        </p>
      </div>
    </div>
  );

  if (!collapsible) {
    return (
      <div className="border border-border bg-muted/50 p-5">
        <div className="flex items-center gap-2">
          <Calculator className="size-4 text-brand-purple" />
          <h3 className="text-sm font-semibold">Financing Calculator</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Estimate your monthly payment. Actual rates may vary.
        </p>
        <div className="mt-5">{calculatorBody}</div>
      </div>
    );
  }

  return (
    <Accordion defaultValue={["calculator"]} className="border border-border bg-muted/50">
      <AccordionItem value="calculator" className="border-0">
        <AccordionTrigger className="px-5 py-4 hover:no-underline">
          <div className="flex items-center gap-2 text-left">
            <Calculator className="size-4 shrink-0 text-brand-purple" />
            <div>
              <span className="text-sm font-semibold">Financing Calculator</span>
              <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                From {formatPrice(monthly)}/mo · {downPaymentPercent}% down
              </p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-5 pb-5">
          <p className="mb-4 text-xs text-muted-foreground">
            Estimate your monthly payment. Actual rates may vary.
          </p>
          {calculatorBody}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
