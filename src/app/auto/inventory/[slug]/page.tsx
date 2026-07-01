import { VehicleDetailPage } from "@/components/vehicle/vehicle-detail-page";
import { fetchVehicleBySlug } from "@/lib/supabase/vehicles";
import { formatVehicleName } from "@/lib/format";
import type { Metadata } from "next";

export const revalidate = 60;

interface VehiclePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: VehiclePageProps): Promise<Metadata> {
  try {
    const { slug } = await params;
    const vehicle = await fetchVehicleBySlug(slug);
    if (!vehicle) return { title: "Vehicle Not Found" };

    return {
      title: formatVehicleName(vehicle),
      description: vehicle.description,
    };
  } catch {
    return { title: "Vehicle" };
  }
}

export default async function VehiclePage({ params }: VehiclePageProps) {
  const { slug } = await params;
  return <VehicleDetailPage slug={slug} />;
}
