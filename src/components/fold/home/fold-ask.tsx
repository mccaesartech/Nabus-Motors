"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FoldIndex, FoldRule } from "@/components/fold/fold-primitives";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const SHOP_PANELS = [
  {
    id: "budget",
    label: "Budget",
    options: [
      { label: "Under $20k", href: `${ROUTES.auto.inventory}?priceMax=20000` },
      { label: "$20k to $40k", href: `${ROUTES.auto.inventory}?priceMin=20000&priceMax=40000` },
      { label: "$40k and above", href: `${ROUTES.auto.inventory}?priceMin=40000` },
    ],
  },
  {
    id: "body",
    label: "Body",
    options: [
      { label: "SUV", href: `${ROUTES.auto.inventory}?bodyType=SUV` },
      { label: "Sedan", href: `${ROUTES.auto.inventory}?bodyType=Sedan` },
      { label: "Truck", href: `${ROUTES.auto.inventory}?bodyType=Truck` },
      { label: "Luxury", href: `${ROUTES.auto.inventory}?bodyType=Luxury` },
    ],
  },
  {
    id: "brand",
    label: "Brand",
    options: [
      { label: "Toyota", href: `${ROUTES.auto.inventory}?make=Toyota` },
      { label: "BMW", href: `${ROUTES.auto.inventory}?make=BMW` },
      { label: "Mercedes", href: `${ROUTES.auto.inventory}?make=Mercedes-Benz` },
      { label: "All makes", href: ROUTES.auto.inventory },
    ],
  },
  {
    id: "year",
    label: "Year",
    options: [
      { label: "2024 and newer", href: `${ROUTES.auto.inventory}?yearMin=2024` },
      { label: "2020 to 2023", href: `${ROUTES.auto.inventory}?yearMin=2020&yearMax=2023` },
      { label: "2015 to 2019", href: `${ROUTES.auto.inventory}?yearMin=2015&yearMax=2019` },
    ],
  },
] as const;

export function FoldAsk() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`${ROUTES.auto.inventory}?q=${encodeURIComponent(q)}`);
  }

  const active = SHOP_PANELS.find((panel) => panel.id === open);

  return (
    <section className="relative bg-[var(--nabus-paper)] py-20 sm:py-28">
      <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8 xl:px-10">
        <FoldIndex n="02" />
        <h2 className="font-display mt-4 max-w-xl text-[clamp(2rem,5vw,3.75rem)] leading-[1.08] text-[var(--nabus-graphite)]">
          What are you after?
        </h2>
        <FoldRule className="mt-6" />

        <form onSubmit={handleSearch} className="mt-10 max-w-xl">
          <label htmlFor="fold-home-search" className="sr-only">
            Search vehicles
          </label>
          <input
            id="fold-home-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a make, model, or year"
            className="w-full border-0 border-b border-[var(--nabus-graphite)] bg-transparent px-0 py-3 text-lg text-[var(--nabus-graphite)] placeholder:text-[var(--nabus-muted)] focus:border-[var(--nabus-wine)] focus:outline-none"
          />
        </form>

        <div className="mt-10 flex flex-wrap gap-2">
          {SHOP_PANELS.map((panel) => (
            <button
              key={panel.id}
              type="button"
              onClick={() => setOpen((current) => (current === panel.id ? null : panel.id))}
              className={cn(
                "h-10 px-4 text-[13px] tracking-wide transition-colors duration-200",
                open === panel.id
                  ? "bg-[var(--nabus-wine)] text-[var(--nabus-paper)]"
                  : "bg-transparent text-[var(--nabus-graphite)] ring-1 ring-[var(--nabus-border)] hover:ring-[var(--nabus-wine)]"
              )}
            >
              {panel.label}
            </button>
          ))}
        </div>

        {active ? (
          <div className="mt-8 max-w-xl border-t border-[var(--nabus-border)] pt-6">
            <p className="font-mono text-[11px] tracking-[0.16em] uppercase text-[var(--nabus-muted)]">
              Shop by {active.label}
            </p>
            <ul className="mt-4 flex flex-col gap-3">
              {active.options.map((opt) => (
                <li key={opt.label}>
                  <button
                    type="button"
                    onClick={() => router.push(opt.href)}
                    className="text-left text-lg text-[var(--nabus-graphite)] underline decoration-transparent underline-offset-4 transition-colors hover:text-[var(--nabus-wine)] hover:decoration-[var(--nabus-wine)]"
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
