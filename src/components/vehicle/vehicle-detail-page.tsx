import dynamic from "next/dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/shared/container";
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
    <div className="py-10 sm:py-14">
      <Container>
        <nav className="mb-6 text-sm text-[var(--nabus-text-secondary)]">
          <Link
            href={ROUTES.auto.inventory}
            prefetch
            className="transition-colors duration-200 hover:text-[var(--nabus-charcoal)]"
          >
            Inventory
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[var(--nabus-charcoal)]">{formatVehicleName(vehicle)}</span>
        </nav>

        <NabusVehicleDetail vehicle={vehicle} />
      </Container>
      <RelatedVehiclesSection vehicle={vehicle} />
    </div>
  );
}
