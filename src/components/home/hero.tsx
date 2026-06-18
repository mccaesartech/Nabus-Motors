import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { vehicleImages } from "@/lib/data/vehicles";
import Link from "next/link";

export function Hero() {
  return (
    <section className="relative bg-brand-charcoal">
      <div className="absolute inset-0">
        <SafeVehicleImage
          src={vehicleImages.hero}
          alt="Premium luxury vehicle"
          priority
          className="opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-black via-brand-black/80 to-brand-charcoal/60" />
      </div>

      <Container className="relative py-24 sm:py-32 lg:py-40">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand-gold">
            True Goshen Enterprise
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
            Drive With Confidence
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-text-secondary sm:text-lg">
            Curated premium vehicles, transparent pricing, and a first-class
            ownership experience from inquiry to delivery.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button size="lg" render={<Link href="/inventory" />}>
              Browse Inventory
            </Button>
            <Button
              size="lg"
              variant="luxury"
              render={<Link href="/sell" />}
            >
              Sell Your Vehicle
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
