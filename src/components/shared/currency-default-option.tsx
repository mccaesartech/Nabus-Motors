"use client";

import { Star } from "lucide-react";
import { countryForCurrency, type CountryCode } from "@/lib/countries";
import { getCurrencyLabel } from "@/lib/currency/names";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CountryFlag } from "@/components/shared/country-flag";
import { cn } from "@/lib/utils";

export function currencyDefaultLabel(currency: string): string {
  const label = getCurrencyLabel(currency);
  return `Default - ${currency} (${label})`;
}

type CurrencyDefaultOptionProps = {
  settingsDefaultCurrency: string;
  currentCountry: CountryCode;
  onSelect: () => void;
  className?: string;
};

export function CurrencyDefaultOption({
  settingsDefaultCurrency,
  currentCountry,
  onSelect,
  className,
}: CurrencyDefaultOptionProps) {
  const defaultCountry = countryForCurrency(settingsDefaultCurrency);
  const isSelected = currentCountry === defaultCountry;

  return (
    <>
      <DropdownMenuItem
        className={cn(
          "cursor-pointer text-xs font-medium",
          isSelected && "bg-accent",
          className
        )}
        onClick={onSelect}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          <Star
            className="size-3.5 shrink-0 text-amber-500/80"
            aria-hidden
          />
          <CountryFlag code={defaultCountry} />
          <span className="truncate">
            {currencyDefaultLabel(settingsDefaultCurrency)}
          </span>
        </span>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
    </>
  );
}

