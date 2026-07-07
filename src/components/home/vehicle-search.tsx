"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { makes, modelsByMake, locations } from "@/lib/data/catalog-meta";
import { buildFilterSearchParams } from "@/lib/vehicles";
import { ROUTES } from "@/lib/routes";
import { setLastInventorySearch } from "@/lib/journey-history";
import { recordSearchPreferences } from "@/lib/vehicle-preferences";
import { PRICE_FILTER_TIERS, formatFilterPriceLabel } from "@/lib/currency";
import { useCurrency } from "@/context/currency-context";
import type { Condition, FuelType, Transmission } from "@/lib/types";

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 15 }, (_, i) => currentYear - i);

export function VehicleSearch() {
  const router = useRouter();
  const { currency } = useCurrency();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [transmission, setTransmission] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [condition, setCondition] = useState("");
  const [location, setLocation] = useState("");

  const availableModels = make ? modelsByMake[make] ?? [] : [];

  function handleSearch() {
    const filters = {
      make: make || undefined,
      model: model || undefined,
      yearMin: year ? Number(year) : undefined,
      yearMax: year ? Number(year) : undefined,
      priceMax: priceMax ? Number(priceMax) : undefined,
      transmission: (transmission as Transmission) || undefined,
      fuelType: (fuelType as FuelType) || undefined,
      condition: (condition as Condition) || undefined,
      location: location || undefined,
    };
    const params = buildFilterSearchParams(filters);
    const url = `${ROUTES.auto.inventory}?${params.toString()}`;
    setLastInventorySearch(url);
    recordSearchPreferences(filters);
    router.push(url);
  }

  return (
    <section className="relative z-10 -mt-12 pb-8 sm:-mt-14 lg:-mt-16">
      <Container>
        <div className="w-full rounded-sm border border-border/60 bg-card p-4 shadow-luxury-lg sm:p-8 lg:p-10">
          <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            Find Your Vehicle
          </h2>

          <div className="mt-6 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 xl:gap-6">
            <div className="space-y-2">
              <Label htmlFor="search-make" className="text-xs font-medium">
                Make
              </Label>
              <Select
                value={make}
                onValueChange={(v) => {
                  setMake(v ?? "");
                  setModel("");
                }}
              >
                <SelectTrigger id="search-make" className="w-full">
                  <SelectValue placeholder="Any make" />
                </SelectTrigger>
                <SelectContent>
                  {makes.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-model" className="text-xs font-medium">
                Model
              </Label>
              <Select value={model} onValueChange={(v) => setModel(v ?? "")} disabled={!make}>
                <SelectTrigger id="search-model" className="w-full">
                  <SelectValue placeholder="Any model" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-year" className="text-xs font-medium">
                Year
              </Label>
              <Select value={year} onValueChange={(v) => setYear(v ?? "")}>
                <SelectTrigger id="search-year" className="w-full">
                  <SelectValue placeholder="Any year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-price" className="text-xs font-medium">
                Max Price
              </Label>
              <Select value={priceMax} onValueChange={(v) => setPriceMax(v ?? "")}>
                <SelectTrigger id="search-price" className="w-full">
                  <SelectValue placeholder="Any price" />
                </SelectTrigger>
                <SelectContent>
                  {PRICE_FILTER_TIERS.map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      {formatFilterPriceLabel(p, currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-transmission" className="text-xs font-medium">
                Transmission
              </Label>
              <Select value={transmission} onValueChange={(v) => setTransmission(v ?? "")}>
                <SelectTrigger id="search-transmission" className="w-full">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {["Automatic", "Manual", "CVT", "DCT"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-fuel" className="text-xs font-medium">
                Fuel Type
              </Label>
              <Select value={fuelType} onValueChange={(v) => setFuelType(v ?? "")}>
                <SelectTrigger id="search-fuel" className="w-full">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {["Petrol", "Diesel", "Hybrid", "Electric", "Plug-in Hybrid"].map(
                    (f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-condition" className="text-xs font-medium">
                Condition
              </Label>
              <Select value={condition} onValueChange={(v) => setCondition(v ?? "")}>
                <SelectTrigger id="search-condition" className="w-full">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {["New", "Used", "Certified Pre-Owned"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-location" className="text-xs font-medium">
                Location
              </Label>
              <Select value={location} onValueChange={(v) => setLocation(v ?? "")}>
                <SelectTrigger id="search-location" className="w-full">
                  <SelectValue placeholder="Any location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-8 flex justify-stretch sm:justify-end">
            <Button onClick={handleSearch} className="w-full min-w-0 sm:w-auto sm:min-w-[160px]">
              <Search className="size-4" />
              Search Inventory
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
