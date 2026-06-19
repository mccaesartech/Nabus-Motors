import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Fuel,
  Gauge,
  MapPin,
  Settings,
  Shield,
} from "lucide-react";
import { Container } from "@/components/shared/container";
import { VehicleGallery } from "@/components/vehicle/vehicle-gallery";
import { FinancingCalculator } from "@/components/vehicle/financing-calculator";
import { ContactActions } from "@/components/vehicle/contact-actions";
import { VehicleRecentTracker } from "@/components/vehicle/vehicle-recent-tracker";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { fetchVehicleBySlug } from "@/lib/supabase/vehicles";
import { primaryPhotoFor } from "@/lib/data/vehicle-images";
import {
  formatMileage,
  formatPrice,
  formatVehicleName,
} from "@/lib/format";

interface VehicleDetailPageProps {
  slug: string;
}

export async function VehicleDetailPage({ slug }: VehicleDetailPageProps) {
  const vehicle = await fetchVehicleBySlug(slug);

  if (!vehicle) notFound();

  return (
    <div className="py-10 sm:py-14">
      <VehicleRecentTracker vehicleId={vehicle.id} />
      <Container>
        <nav className="mb-6 text-sm text-muted-foreground">
          <Link href="/inventory" className="hover:text-foreground">
            Inventory
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{formatVehicleName(vehicle)}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <VehicleGallery
              images={[primaryPhotoFor(vehicle)]}
              alt={formatVehicleName(vehicle)}
            />

            <div className="mt-10">
              <h2 className="text-lg font-semibold">Vehicle Specifications</h2>
              <div className="mt-4 grid gap-px bg-border sm:grid-cols-2">
                {vehicle.specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="flex justify-between bg-white px-4 py-3 text-sm"
                  >
                    <span className="text-muted-foreground">{spec.label}</span>
                    <span className="font-medium">{spec.value}</span>
                  </div>
                ))}
                <div className="flex justify-between bg-white px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Exterior Color</span>
                  <span className="font-medium">{vehicle.color}</span>
                </div>
                <div className="flex justify-between bg-white px-4 py-3 text-sm">
                  <span className="text-muted-foreground">VIN</span>
                  <span className="font-medium font-mono text-xs">
                    {vehicle.vin}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-10">
              <h2 className="text-lg font-semibold">Vehicle History</h2>
              <div className="mt-4 space-y-0">
                {vehicle.history.map((event, index) => (
                  <div key={index} className="flex gap-4 pb-6 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div className="size-2.5 rounded-full bg-brand-gold" />
                      {index < vehicle.history.length - 1 && (
                        <div className="mt-1 w-px flex-1 bg-border" />
                      )}
                    </div>
                    <div className="pb-2">
                      <p className="text-xs font-medium text-brand-gold">
                        {event.date}
                      </p>
                      <p className="text-sm font-semibold">{event.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {event.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10">
              <h2 className="text-lg font-semibold">Description</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {vehicle.description}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border border-border p-5 shadow-luxury">
              <div className="flex flex-wrap gap-2">
                {vehicle.featured && (
                  <Badge variant="featured">Featured</Badge>
                )}
                {vehicle.condition === "Certified Pre-Owned" && (
                  <Badge variant="verified">Verified</Badge>
                )}
              </div>

              <h1 className="mt-3 text-xl font-semibold leading-tight">
                {formatVehicleName(vehicle)}
              </h1>

              <p className="mt-3 text-3xl font-semibold text-brand-purple">
                {formatPrice(vehicle.price)}
              </p>

              <Separator className="my-5" />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Gauge className="size-4 text-brand-purple" />
                  <span>{formatMileage(vehicle.mileage)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-brand-purple" />
                  <span>{vehicle.year}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Fuel className="size-4 text-brand-purple" />
                  <span>{vehicle.fuelType}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Settings className="size-4 text-brand-purple" />
                  <span>{vehicle.transmission}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="size-4 text-brand-gold" />
                  <span>{vehicle.engineSize}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-brand-gold" />
                  <span>{vehicle.location}</span>
                </div>
              </div>

              <Separator className="my-5" />

              <ContactActions vehicle={vehicle} />
            </div>

            <FinancingCalculator price={vehicle.price} />
          </div>
        </div>
      </Container>
    </div>
  );
}
