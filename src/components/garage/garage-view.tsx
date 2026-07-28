"use client";

import Link from "next/link";
import { ArrowRightLeft, Clock, Heart, TrendingDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Container } from "@/components/shared/container";
import { VehicleCard } from "@/components/shared/vehicle-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  buildVehicleLookupMap,
  useGarage,
  useGarageVehicles,
} from "@/hooks/use-garage";
import { useRequireCustomerAuth } from "@/hooks/use-require-customer-auth";
import { useCurrency } from "@/context/currency-context";
import { ROUTES } from "@/lib/routes";
import type { Vehicle } from "@/lib/types";

export function GarageView() {
  const { user, loading: authLoading } = useRequireCustomerAuth();
  const { savedIds, priceMap, recentIds, loaded, clearSaved } = useGarage();
  const { formatPrice, formatVehicleListPrice } = useCurrency();
  const [toast, setToast] = useState<string | null>(null);

  const handleSaveToggle = useCallback((action: "saved" | "removed") => {
    if (action === "removed") {
      setToast("Removed from saved");
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleClearAll = useCallback(() => {
    clearSaved();
    setToast("All saved vehicles cleared");
  }, [clearSaved]);

  const lookupIds = useMemo(
    () => [...new Set([...savedIds, ...recentIds])],
    [savedIds, recentIds]
  );

  const { vehicles: garageVehicles, loaded: vehiclesLoaded } =
    useGarageVehicles(lookupIds, savedIds);

  const vehicleById = useMemo(
    () => buildVehicleLookupMap(garageVehicles),
    [garageVehicles]
  );

  const savedVehicles = savedIds
    .map((id) => vehicleById.get(id))
    .filter((v): v is Vehicle => Boolean(v));

  const recentVehicles = recentIds
    .map((id) => vehicleById.get(id))
    .filter((v): v is Vehicle => Boolean(v));

  if (authLoading || !user) {
    return (
      <Container className="py-20">
        <p className="text-sm text-muted-foreground">Loading your garage…</p>
      </Container>
    );
  }

  if (!loaded || (lookupIds.length > 0 && !vehiclesLoaded)) {
    return (
      <Container className="py-20">
        <p className="text-sm text-muted-foreground">Loading your garage...</p>
      </Container>
    );
  }

  return (
    <div className="py-10 sm:py-14">
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md border border-brand-purple/30 bg-background px-4 py-2 text-sm font-medium text-foreground shadow-luxury"
        >
          {toast}
        </div>
      )}
      <Container>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            My Garage
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage saved vehicles, track price changes, and review recently viewed
            inventory.
          </p>
        </div>

        <Tabs defaultValue="saved">
          <TabsList>
            <TabsTrigger value="saved">
              <Heart className="size-3.5" />
              Saved ({savedVehicles.length})
            </TabsTrigger>
            <TabsTrigger value="recent">
              <Clock className="size-3.5" />
              Recently Viewed ({recentVehicles.length})
            </TabsTrigger>
            <TabsTrigger value="compare">
              <ArrowRightLeft className="size-3.5" />
              Compare
            </TabsTrigger>
          </TabsList>

          <TabsContent value="saved" className="mt-6">
            {savedVehicles.length > 0 ? (
              <div className="space-y-6">
                {savedVehicles.length > 1 && (
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearAll}
                      className="text-muted-foreground transition-colors hover:border-brand-purple/40 hover:bg-brand-purple/5 hover:text-brand-purple"
                    >
                      Clear all saved vehicles
                    </Button>
                  </div>
                )}
                {savedVehicles.some(
                  (v) => priceMap[v.id] && priceMap[v.id] > v.price
                ) && (
                  <div className="flex items-center gap-2 border border-border bg-muted px-4 py-3 text-sm">
                    <TrendingDown className="size-4 text-muted-foreground" />
                    Price drops detected on saved vehicles
                  </div>
                )}
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {savedVehicles.map((vehicle) => {
                    const prevPrice = priceMap[vehicle.id];
                    const priceDrop = prevPrice && prevPrice > vehicle.price;
                    return (
                      <div key={vehicle.id} className="relative">
                        {priceDrop && (
                          <div className="absolute -top-2 right-2 z-10 bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">
                            Price dropped {formatPrice(prevPrice - vehicle.price)}
                          </div>
                        )}
                        <VehicleCard
                          vehicle={vehicle}
                          showRemoveAction
                          onSaveToggle={handleSaveToggle}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : savedIds.length > 0 ? (
              <div className="border border-dashed border-border py-16 text-center">
                <p className="text-sm font-medium">Saved vehicles unavailable</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {savedIds.length === 1
                    ? "1 saved vehicle could not be found. It may have been sold or removed."
                    : `${savedIds.length} saved vehicles could not be found. They may have been sold or removed.`}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button variant="outline" onClick={handleClearAll}>
                    Clear saved
                  </Button>
                  <Button render={<Link href={ROUTES.auto.inventory} />}>Browse Inventory</Button>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No saved vehicles"
                description="Save vehicles from inventory to track them here."
                href={ROUTES.auto.inventory}
                label="Browse Inventory"
              />
            )}
          </TabsContent>

          <TabsContent value="recent" className="mt-6">
            {recentVehicles.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {recentVehicles.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No recently viewed vehicles"
                description="Vehicles you view will appear here for easy access."
                href={ROUTES.auto.inventory}
                label="Browse Inventory"
              />
            )}
          </TabsContent>

          <TabsContent value="compare" className="mt-6">
            {savedVehicles.length >= 2 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 pr-4 text-left text-xs font-medium text-muted-foreground">
                        Specification
                      </th>
                      {savedVehicles.slice(0, 3).map((v) => (
                        <th
                          key={v.id}
                          className="py-3 px-4 text-left text-xs font-semibold"
                        >
                          {v.year} {v.make} {v.model}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Price", get: (v: Vehicle) => formatVehicleListPrice({
                        price: v.price,
                        priceCurrency: v.priceCurrency,
                        listedPrice: v.listedPrice,
                      }) },
                      { label: "Mileage", get: (v: Vehicle) => v.mileage.toLocaleString() + " mi" },
                      { label: "Year", get: (v: Vehicle) => String(v.year) },
                      { label: "Fuel", get: (v: Vehicle) => v.fuelType },
                      { label: "Transmission", get: (v: Vehicle) => v.transmission },
                      { label: "Condition", get: (v: Vehicle) => v.condition },
                    ].map((row) => (
                      <tr key={row.label} className="border-b border-border">
                        <td className="py-3 pr-4 text-muted-foreground">
                          {row.label}
                        </td>
                        {savedVehicles.slice(0, 3).map((v) => (
                          <td key={v.id} className="py-3 px-4 font-medium">
                            {row.get(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="Save at least 2 vehicles to compare"
                description="Add vehicles to your saved list to compare specifications side by side."
                href={ROUTES.auto.inventory}
                label="Browse Inventory"
              />
            )}
          </TabsContent>
        </Tabs>
      </Container>
    </div>
  );
}

function EmptyState({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href: string;
  label: string;
}) {
  return (
    <div className="border border-dashed border-border py-16 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <Button className="mt-4" render={<Link href={href} />}>
        {label}
      </Button>
    </div>
  );
}
