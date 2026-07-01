import { notFound } from "next/navigation";
import {
  Calendar,
  Fuel,
  Gauge,
  MapPin,
  Settings,
  Shield,
} from "lucide-react";
import { Container } from "@/components/shared/container";
import { FullPageLink } from "@/components/shared/full-page-link";
import { BackNav } from "@/components/shared/back-nav";
import { VehicleGallery } from "@/components/vehicle/vehicle-gallery";
import { VehicleDetailSidebar } from "@/components/vehicle/vehicle-detail-sidebar";
import { fetchVehicleBySlug } from "@/lib/supabase/vehicles";
import { ROUTES } from "@/lib/routes";
import { formatMileage, formatVehicleName } from "@/lib/format";

interface VehicleDetailPageProps {
  slug: string;
}

export async function VehicleDetailPage({ slug }: VehicleDetailPageProps) {
  let vehicle = null;

  try {
    vehicle = await fetchVehicleBySlug(slug);
  } catch (err) {
    console.error("Vehicle detail fetch failed:", err);
  }

  if (!vehicle) notFound();

  const specs = vehicle.specs ?? [];
  const history = vehicle.history ?? [];

  return (
    <div className="py-10 sm:py-14">
      <Container>
        <BackNav
          href={ROUTES.auto.inventory}
          label="Back to inventory"
          variant="public"
          className="mb-4"
        />
        <nav className="mb-6 hidden text-sm text-muted-foreground sm:block">
          <FullPageLink href={ROUTES.auto.inventory} className="hover:text-foreground">
            Inventory
          </FullPageLink>
          <span className="mx-2">/</span>
          <span className="text-foreground">{formatVehicleName(vehicle)}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <VehicleGallery
              gallery={vehicle.gallery}
              images={vehicle.images}
              alt={formatVehicleName(vehicle)}
            />

            <div className="mt-10">
              <h2 className="text-lg font-semibold">Vehicle Specifications</h2>
              <div className="mt-4 grid gap-px bg-border sm:grid-cols-2">
                {specs.map((spec) => (
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
                  <span className="font-medium font-mono text-xs break-all">{vehicle.vin}</span>
                </div>
              </div>
            </div>

            {history.length > 0 && (
              <div className="mt-10">
                <h2 className="text-lg font-semibold">Vehicle History</h2>
                <div className="mt-4 space-y-0">
                  {history.map((event, index) => (
                    <div key={index} className="flex gap-4 pb-6 last:pb-0">
                      <div className="flex flex-col items-center">
                        <div className="size-2.5 rounded-full bg-foreground" />
                        {index < history.length - 1 && (
                          <div className="mt-1 w-px flex-1 bg-border" />
                        )}
                      </div>
                      <div className="pb-2">
                        <p className="text-xs font-medium text-muted-foreground">
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
            )}

            <div className="mt-10">
              <h2 className="text-lg font-semibold">Description</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {vehicle.description}
              </p>
            </div>
          </div>

          <VehicleDetailSidebar vehicle={vehicle} />
        </div>
      </Container>
    </div>
  );
}
