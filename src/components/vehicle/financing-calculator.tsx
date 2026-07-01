"use client";

import { useState } from "react";
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

interface FinancingCalculatorProps {
  price: number;
}

export function FinancingCalculator({ price }: FinancingCalculatorProps) {
  const { formatPrice } = useCurrency();
  const [downPayment, setDownPayment] = useState(Math.round(price * 0.1));
  const [term, setTerm] = useState("60");
  const [rate, setRate] = useState("6.9");

  const monthly = calculateMonthlyPayment(
    price,
    downPayment,
    Number(rate),
    Number(term)
  );

  return (
    <div className="border border-border bg-muted/50 p-5">
      <h3 className="text-sm font-semibold">Financing Calculator</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Estimate your monthly payment. Actual rates may vary.
      </p>

      <div className="mt-5 space-y-5">
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <Label>Down Payment</Label>
            <span className="font-medium">{formatPrice(downPayment)}</span>
          </div>
          <Slider
            value={[downPayment]}
            min={0}
            max={Math.round(price * 0.5)}
            step={500}
            onValueChange={(v) => {
              const value = Array.isArray(v) ? v[0] : v;
              if (typeof value === "number") setDownPayment(value);
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Term</Label>
            <Select value={term} onValueChange={(v) => setTerm(v ?? "60")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[36, 48, 60, 72, 84].map((t) => (
                  <SelectItem key={t} value={String(t)}>
                    {t} months
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">APR</Label>
            <Select value={rate} onValueChange={(v) => setRate(v ?? "6.9")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["4.9", "5.9", "6.9", "7.9", "8.9"].map((r) => (
                  <SelectItem key={r} value={r}>
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
        </div>
      </div>
    </div>
  );
}
