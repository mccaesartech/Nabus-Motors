import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { Container } from "@/components/shared/container";
import { SafeVehicleImage } from "@/components/shared/safe-vehicle-image";
import { getLocallyAvailableVehicles } from "@/lib/supabase/vehicles";
import { primaryPhotoFor } from "@/lib/data/vehicle-images";
import { formatVehicleName } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type LocallyAvailableCarsBannerProps = {
  className?: string;
  /** Tighter padding for auto homepage strip. */
  variant?: "default" | "compact";
  /** Optional preloaded vehicles — skips a second DB round-trip when provided. */
  vehicles?: Awaited<ReturnType<typeof getLocallyAvailableVehicles>>;
};

export async function LocallyAvailableCarsBanner({
  className,
  variant = "default",
  vehicles: vehiclesProp,
}: LocallyAvailableCarsBannerProps) {
  const vehicles = vehiclesProp ?? (await getLocallyAvailableVehicles());
  if (!vehicles.length) return null;

  const preview = vehicles.slice(0, 3);
  const countLabel =
    vehicles.length === 1 ? "1 car" : `${vehicles.length} cars`;

  return (
    <section
      className={cn(
        variant === "compact"
          ? "border-b border-border bg-muted/20 py-4"
          : "border-b border-border bg-background py-6 sm:py-8",
        className
      )}
      aria-label="Locally available vehicles"
    >
      <Container>
        <Link
          href={ROUTES.auto.availableLocally}
          className="group relative block overflow-hidden rounded-xl border border-brand-purple/30 bg-gradient-to-r from-brand-purple/10 via-brand-gold/8 to-brand-purple/5 p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5"
        >
          <span
            className="local-availability-pulse-ring pointer-events-none absolute inset-0 rounded-xl"
            aria-hidden
          />
          <span
            className="local-availability-pulse-ring local-availability-pulse-delay pointer-events-none absolute inset-0 rounded-xl"
            aria-hidden
          />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3 sm:items-center">
              <div className="relative flex size-11 shrink-0 items-center justify-center rounded-lg border border-brand-gold/45 bg-brand-gold/15">
                <span
                  className="local-availability-icon-pulse absolute inset-0 rounded-lg"
                  aria-hidden
                />
                <MapPin className="relative size-5 text-brand-purple" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">
                  {countLabel} in Ghana
                </p>
                <p className="mt-0.5 text-base font-semibold text-foreground sm:text-lg">
                  Browse cars ready in Ghana
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  In-stock Ghana inventory and newly arrived vehicles — no international
                  shipping required.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3 self-end sm:self-center">
              {preview.length > 0 && (
                <div className="hidden items-center -space-x-2 sm:flex">
                  {preview.map((vehicle) => (
                    <div
                      key={vehicle.id}
                      className="relative size-10 overflow-hidden rounded-lg border-2 border-background shadow-sm"
                      title={formatVehicleName(vehicle)}
                    >
                      <SafeVehicleImage
                        src={primaryPhotoFor(vehicle)}
                        alt={formatVehicleName(vehicle)}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                  ))}
                </div>
              )}

              <span className="inline-flex items-center gap-2 rounded-lg bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-brand-purple-dark">
                Browse now
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
        </Link>
      </Container>
    </section>
  );
}
