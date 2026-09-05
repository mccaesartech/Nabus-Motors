import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { NabusVehicleCard } from "@/components/nabus/nabus-vehicle-card";
import { Button } from "@/components/ui/button";
import { fetchFeaturedVehicles } from "@/lib/supabase/vehicles";

export async function FeaturedVehicles() {
  const featured = await fetchFeaturedVehicles();

  return (
    <section className="py-16 sm:py-20">
      <Container>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeader
            title="Featured Vehicles"
            description="Hand-selected inventory meeting our quality and inspection standards."
            className="mb-0"
          />
          <Button
            variant="ghost"
            size="sm"
            className="hidden shrink-0 text-brand-purple hover:text-foreground sm:inline-flex"
            render={<Link href={ROUTES.auto.inventory} />}
          >
            View All
            <ArrowRight className="size-4" />
          </Button>
        </div>

        <div className="mt-8 grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {featured.slice(0, 6).map((vehicle) => (
            <NabusVehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Button variant="outline" render={<Link href={ROUTES.auto.inventory} />}>
            View All Inventory
          </Button>
        </div>
      </Container>
    </section>
  );
}
