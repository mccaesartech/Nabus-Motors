"use client";

import Link from "next/link";
import { ArrowRightLeft, Clock, Heart, TrendingDown } from "lucide-react";
import { Container } from "@/components/shared/container";
import { VehicleCard } from "@/components/shared/vehicle-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { vehicles } from "@/lib/data/vehicles";
import { formatPrice } from "@/lib/format";
import { useGarage } from "@/hooks/use-garage";

export default function GaragePage() {
  const { savedIds, priceMap, recentIds, loaded } = useGarage();

  const savedVehicles = vehicles.filter((v) => savedIds.includes(v.id));
  const recentVehicles = recentIds
    .map((id) => vehicles.find((v) => v.id === id))
    .filter(Boolean);

  if (!loaded) {
    return (
      <Container className="py-20">
        <p className="text-sm text-muted-foreground">Loading your garage...</p>
      </Container>
    );
  }

  return (
    <div className="py-10 sm:py-14">
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
                {savedVehicles.some(
                  (v) => priceMap[v.id] && priceMap[v.id] > v.price
                ) && (
                  <div className="flex items-center gap-2 border border-brand-gold/30 bg-brand-gold/5 px-4 py-3 text-sm">
                    <TrendingDown className="size-4 text-brand-gold" />
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
                          <div className="absolute -top-2 right-2 z-10 bg-brand-gold px-2 py-0.5 text-[10px] font-semibold text-brand-black">
                            Price dropped {formatPrice(prevPrice - vehicle.price)}
                          </div>
                        )}
                        <VehicleCard vehicle={vehicle} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyState
                title="No saved vehicles"
                description="Save vehicles from inventory to track them here."
                href="/inventory"
                label="Browse Inventory"
              />
            )}
          </TabsContent>

          <TabsContent value="recent" className="mt-6">
            {recentVehicles.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {recentVehicles.map(
                  (vehicle) =>
                    vehicle && <VehicleCard key={vehicle.id} vehicle={vehicle} />
                )}
              </div>
            ) : (
              <EmptyState
                title="No recently viewed vehicles"
                description="Vehicles you view will appear here for easy access."
                href="/inventory"
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
                      { label: "Price", get: (v: typeof savedVehicles[0]) => formatPrice(v.price) },
                      { label: "Mileage", get: (v: typeof savedVehicles[0]) => v.mileage.toLocaleString() + " mi" },
                      { label: "Year", get: (v: typeof savedVehicles[0]) => String(v.year) },
                      { label: "Fuel", get: (v: typeof savedVehicles[0]) => v.fuelType },
                      { label: "Transmission", get: (v: typeof savedVehicles[0]) => v.transmission },
                      { label: "Condition", get: (v: typeof savedVehicles[0]) => v.condition },
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
                href="/inventory"
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
