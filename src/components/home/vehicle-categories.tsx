import Link from "next/link";
import { Container } from "@/components/shared/container";
import { SectionHeader } from "@/components/shared/section-header";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { categories } from "@/lib/data/vehicles";

export function VehicleCategories() {
  return (
    <section className="py-16 sm:py-20">
      <Container>
        <SectionHeader
          title="Browse by Category"
          description="Explore our inventory organized by vehicle type."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={category.href ?? `/inventory?bodyType=${category.slug}`}
              className="group relative aspect-[16/10] overflow-hidden"
            >
              <SafeVehicleImage
                src={category.image}
                alt={category.name}
                className="transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-black/90 via-brand-black/40 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <h3 className="text-lg font-semibold text-white">
                  {category.name}
                </h3>
                <p className="mt-1 text-sm text-white/70">
                  {category.count} vehicle{category.count !== 1 ? "s" : ""}{" "}
                  available
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
