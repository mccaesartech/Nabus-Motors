import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/shared/container";
import { NabusVehicleCard } from "@/components/nabus/nabus-vehicle-card";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import type { Vehicle } from "@/lib/types";

type NabusFeaturedCarouselProps = {
  vehicles: Vehicle[];
};

export function NabusFeaturedCarousel({ vehicles }: NabusFeaturedCarouselProps) {
  if (vehicles.length === 0) return null;

  return (
    <section className="bg-[var(--nabus-background)] py-14 sm:py-16">
      <Container>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--nabus-charcoal)] sm:text-2xl">
              Available Vehicles
            </h2>
            <p className="mt-1 text-sm text-[var(--nabus-text-secondary)]">
              Hand-picked from our current inventory
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="hidden rounded-lg border-[var(--nabus-input-border)] sm:inline-flex"
            render={<Link href={ROUTES.auto.inventory} />}
          >
            View All
            <ArrowRight className="size-4" />
          </Button>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {vehicles.slice(0, 4).map((vehicle) => (
            <NabusVehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Button
            variant="outline"
            className="rounded-lg border-[var(--nabus-primary)] text-[var(--nabus-primary)]"
            render={<Link href={ROUTES.auto.inventory} />}
          >
            View All
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </Container>
    </section>
  );
}
