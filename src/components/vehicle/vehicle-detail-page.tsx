import dynamic from "next/dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchVehicleBySlug } from "@/lib/supabase/vehicles";
import { formatVehicleName } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { NabusVehicleDetail } from "@/components/nabus/nabus-vehicle-detail";

const RelatedVehiclesSection = dynamic(
  () =>
    import("@/components/vehicle/related-vehicles-section").then((m) => ({
      default: m.RelatedVehiclesSection,
    })),
  { loading: () => null }
);

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

  return (
    <div className="bg-[var(--nabus-ivory)] py-8 sm:py-12">
      <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8 xl:px-10">
        <nav className="mb-6 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--nabus-muted)]">
          <Link
            href={ROUTES.auto.inventory}
            prefetch
            className="transition-colors duration-200 hover:text-[var(--nabus-graphite)]"
          >
            Cars
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[var(--nabus-graphite)]">{formatVehicleName(vehicle)}</span>
        </nav>

        <NabusVehicleDetail vehicle={vehicle} />
      </div>
      <RelatedVehiclesSection vehicle={vehicle} limit={3} title="Similar" />
    </div>
  );
}
