"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NabusSectionLabel } from "@/components/nabus/nabus-section-label";
import { ROUTES } from "@/lib/routes";

const SHOP_PANELS = [
  {
    label: "Budget",
    options: [
      { label: "Under $20k", href: `${ROUTES.auto.inventory}?priceMax=20000` },
      { label: "$20k – $40k", href: `${ROUTES.auto.inventory}?priceMin=20000&priceMax=40000` },
      { label: "$40k+", href: `${ROUTES.auto.inventory}?priceMin=40000` },
    ],
  },
  {
    label: "Body",
    options: [
      { label: "SUV", href: `${ROUTES.auto.inventory}?bodyType=SUV` },
      { label: "Sedan", href: `${ROUTES.auto.inventory}?bodyType=Sedan` },
      { label: "Truck", href: `${ROUTES.auto.inventory}?bodyType=Truck` },
      { label: "Luxury", href: `${ROUTES.auto.inventory}?bodyType=Luxury` },
    ],
  },
  {
    label: "Brand",
    options: [
      { label: "Toyota", href: `${ROUTES.auto.inventory}?make=Toyota` },
      { label: "BMW", href: `${ROUTES.auto.inventory}?make=BMW` },
      { label: "Mercedes", href: `${ROUTES.auto.inventory}?make=Mercedes-Benz` },
      { label: "All makes", href: ROUTES.auto.inventory },
    ],
  },
  {
    label: "Year",
    options: [
      { label: "2024+", href: `${ROUTES.auto.inventory}?yearMin=2024` },
      { label: "2020 – 2023", href: `${ROUTES.auto.inventory}?yearMin=2020&yearMax=2023` },
      { label: "2015 – 2019", href: `${ROUTES.auto.inventory}?yearMin=2015&yearMax=2019` },
    ],
  },
] as const;

export function SceneFindYourDrive() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`${ROUTES.auto.inventory}?q=${encodeURIComponent(q)}`);
  }

  return (
    <section className="border-b border-[var(--nabus-border)] bg-[var(--nabus-paper)] py-16 sm:py-20">
      <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10 xl:px-12">
        <NabusSectionLabel>Find Your Drive</NabusSectionLabel>
        <h2 className="mt-4 max-w-lg text-3xl font-semibold tracking-tight text-[var(--nabus-graphite)]">
          Search the showroom intelligently.
        </h2>

        <form onSubmit={handleSearch} className="mt-8 max-w-2xl">
          <label htmlFor="home-search" className="sr-only">
            Search vehicles
          </label>
          <input
            id="home-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Make, model, year…"
            className="w-full border border-[var(--nabus-border)] bg-[var(--nabus-ivory)] px-4 py-3.5 text-base text-[var(--nabus-graphite)] placeholder:text-[var(--nabus-muted)] focus:border-[var(--nabus-wine)] focus:outline-none"
          />
        </form>

        <div className="mt-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--nabus-muted)]">
            Shop By
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SHOP_PANELS.map((panel) => (
              <div key={panel.label} className="border-t border-[var(--nabus-border)] pt-4">
                <h3 className="text-sm font-semibold text-[var(--nabus-graphite)]">{panel.label}</h3>
                <ul className="mt-3 space-y-2">
                  {panel.options.map((opt) => (
                    <li key={opt.label}>
                      <button
                        type="button"
                        onClick={() => router.push(opt.href)}
                        className="text-sm text-[var(--nabus-muted)] transition-colors duration-200 hover:text-[var(--nabus-wine)]"
                      >
                        {opt.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
