"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  countryOptionLabel,
  countryTriggerLabel,
  getCountryConfig,
} from "@/lib/countries";
import { usePlatformCurrency } from "@/context/platform-currency-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CountryFlag } from "@/components/shared/country-flag";
import { cn } from "@/lib/utils";

type PlatformCurrencySelectorProps = {
  className?: string;
};

export function PlatformCurrencySelector({
  className,
}: PlatformCurrencySelectorProps) {
  const { country, setCountry, countries } = usePlatformCurrency();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = getCountryConfig(country);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q)
    );
  }, [countries, query]);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-9 max-w-[11rem] items-center justify-between gap-1.5 rounded-md border border-[var(--platform-border)] bg-[var(--platform-card)] px-2.5 text-xs text-[var(--platform-text)] transition-colors outline-none hover:border-[#c4b5fd] focus-visible:border-[var(--platform-accent)] focus-visible:ring-2 focus-visible:ring-[rgba(139,92,246,0.25)]",
          className
        )}
        aria-label="Display currency"
      >
        <span className="flex min-w-0 items-center gap-1.5 truncate text-left">
          <CountryFlag code={selected.code} className="h-3.5 w-[1.3125rem]" />
          <span className="truncate md:hidden" suppressHydrationWarning>
            {selected.currency}
          </span>
          <span className="hidden truncate md:inline" suppressHydrationWarning>
            {countryTriggerLabel(selected)}
          </span>
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-[var(--platform-text-secondary)]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(20rem,calc(100vw-2rem))] p-0"
      >
        <div className="sticky top-0 z-10 border-b border-border bg-popover p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Search country or currency…"
              className="h-8 pl-8 text-xs"
              aria-label="Search currencies"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              No countries match your search
            </p>
          ) : (
            filtered.map((c) => (
              <DropdownMenuItem
                key={c.code}
                className={cn(
                  "cursor-pointer text-xs",
                  c.code === country && "bg-accent"
                )}
                onClick={() => {
                  setCountry(c.code);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="flex min-w-0 items-center gap-2 truncate">
                  <CountryFlag code={c.code} />
                  <span className="truncate">{countryOptionLabel(c)}</span>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
