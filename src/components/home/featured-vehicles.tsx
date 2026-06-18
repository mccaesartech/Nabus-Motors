import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { VehicleCard } from "@/components/shared/vehicle-card";
import { Button } from "@/components/ui/button";
import { fetchFeaturedVehicles } from "@/lib/supabase/vehicles";

export async function FeaturedVehicles() {
  const featured = await fetchFeaturedVehicles();

  return (
    <section className="py-16 sm:py-20">
      <Container>
        <div className="flex items-end justify-between gap-4">
          <SectionHeader
            title="Featured Vehicles"
            description="Hand-selected inventory meeting our quality and inspection standards."
            className="mb-0"
          />
          <Button
            variant="ghost"
            size="sm"
            className="hidden shrink-0 text-brand-purple hover:text-brand-gold sm:inline-flex"
            render={<Link href="/inventory" />}
          >
            View All
            <ArrowRight className="size-4" />
          </Button>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.slice(0, 6).map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Button variant="outline" render={<Link href="/inventory" />}>
            View All Inventory
          </Button>
        </div>
      </Container>
    </section>
  );
}
