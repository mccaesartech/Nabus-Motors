"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  countryOptionLabel,
  countryTriggerLabel,
  getCountryConfig,
} from "@/lib/countries";
import { useCurrency } from "@/context/currency-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CountryFlag } from "@/components/shared/country-flag";
import { cn } from "@/lib/utils";

interface CountrySelectorProps {
  className?: string;
  compact?: boolean;
}

export function CountrySelector({
  className,
  compact = false,
}: CountrySelectorProps) {
  const { country, setCountry, countries } = useCurrency();
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

  const triggerSizing = compact
    ? "h-9 min-w-0 max-w-[10.5rem] px-2 text-xs xl:max-w-[11rem]"
    : "h-9 w-full max-w-[15rem] px-2.5 text-xs";

  const triggerLabel = (config: typeof selected) => (
    <>
      <span className="truncate md:hidden" suppressHydrationWarning>
        {config.currency}
      </span>
      <span className="hidden truncate md:inline" suppressHydrationWarning>
        {countryTriggerLabel(config)}
      </span>
    </>
  );

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
          "inline-flex items-center justify-between gap-1.5 rounded-md border border-white/20 bg-white/5 text-white transition-colors outline-none hover:border-white/30 hover:bg-white/10 focus-visible:border-white/40 focus-visible:ring-3 focus-visible:ring-white/20",
          triggerSizing,
          className
        )}
        aria-label="Country and currency"
      >
        <span className="flex min-w-0 items-center gap-1.5 truncate text-left">
          <CountryFlag
            code={selected.code}
            className={compact ? "h-3.5 w-[1.3125rem]" : undefined}
          />
          {compact ? (
            triggerLabel(selected)
          ) : (
            <span className="truncate" suppressHydrationWarning>
              {countryTriggerLabel(selected)}
            </span>
          )}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-white/60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="z-[60] w-[min(20rem,calc(100vw-2rem))] p-0"
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
              aria-label="Search countries"
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
