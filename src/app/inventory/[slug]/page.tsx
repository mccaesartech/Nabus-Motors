import { VehicleDetailPage } from "@/components/vehicle/vehicle-detail-page";
import { fetchVehicleBySlug } from "@/lib/supabase/vehicles";
import { formatVehicleName } from "@/lib/format";
import type { Metadata } from "next";

interface VehiclePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: VehiclePageProps): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await fetchVehicleBySlug(slug);
  if (!vehicle) return { title: "Vehicle Not Found" };

  return {
    title: formatVehicleName(vehicle),
    description: vehicle.description,
  };
}

export default async function VehiclePage({ params }: VehiclePageProps) {
  const { slug } = await params;
  return <VehicleDetailPage slug={slug} />;
}
